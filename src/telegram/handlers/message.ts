import type { Context } from 'grammy';
import { gateway } from '../../gateway';
import { AppError, ErrorCode } from '../../utils/errors';
import { createChildLogger } from '../../utils/logger';

const logger = createChildLogger('telegram-message');

/**
 * Split long messages into chunks for Telegram's 4096 character limit
 */
function splitMessage(text: string, maxLength = 4000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // No good newline, try space
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // No good split point, just cut
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trimStart();
  }

  return chunks;
}

/**
 * Handle incoming text messages
 */
export async function handleMessage(ctx: Context) {
  const chatId = ctx.chat?.id;
  const messageText = ctx.message?.text;

  if (!chatId || !messageText) {
    return;
  }

  logger.info(
    {
      chatId,
      userId: ctx.from?.id,
      username: ctx.from?.username,
      messageLength: messageText.length,
    },
    'Received message'
  );

  // Send typing indicator
  await ctx.replyWithChatAction('typing');

  // Keep sending typing indicator every 4 seconds
  const typingInterval = setInterval(() => {
    ctx.replyWithChatAction('typing').catch(() => {
      // Ignore errors, the message might have been sent already
    });
  }, 4000);

  try {
    // Process through gateway
    const response = await gateway.processMessage(messageText, chatId, {
      userId: ctx.from?.id,
      messageId: ctx.message?.message_id,
      username: ctx.from?.username,
    });

    // Send response in chunks if needed
    const chunks = splitMessage(response);

    for (const chunk of chunks) {
      await ctx.reply(chunk, {
        parse_mode: 'Markdown',
        // Disable link preview for cleaner output
        link_preview_options: { is_disabled: true },
      }).catch(async () => {
        // If Markdown fails, try plain text
        await ctx.reply(chunk);
      });
    }

    logger.info(
      { chatId, responseLength: response.length, chunks: chunks.length },
      'Response sent'
    );
  } catch (error) {
    logger.error({ error, chatId }, 'Error processing message');

    // Send user-friendly error message
    if (error instanceof AppError) {
      if (error.code === ErrorCode.CLAUDE_TIMEOUT) {
        await ctx.reply('The response is taking too long. Please try again.');
      } else if (error.code === ErrorCode.CLAUDE_RATE_LIMIT) {
        await ctx.reply('Too many requests. Please wait a moment and try again.');
      } else {
        await ctx.reply('Sorry, an error occurred while processing your message. Please try again.');
      }
    } else {
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  } finally {
    clearInterval(typingInterval);
  }
}
