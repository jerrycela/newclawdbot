# Clawdbot Replica MVP - 10 次迭代審查報告

> 本報告為 MVP 計劃經過 10 次迭代審查後的最終版本

## 迭代方法論

按照專案定義的迭代流程：
- **迭代 1**：完整實作所有面向
- **迭代 2-10**：每次迭代都全面 Review 所有面向，尋找改進空間

審查面向：
1. 完整性
2. 架構
3. 錯誤處理
4. 安全性
5. 效能
6. 開發者體驗 (DX)
7. 測試策略
8. 運維
9. 使用者體驗 (UX)

---

## 10 次迭代摘要

| 迭代 | 主要成就 |
|------|----------|
| 1 | 完整實作 9 個面向的基礎架構，包含型別定義、Graceful Shutdown、串流解析、錯誤處理、安全認證、效能快取、測試結構、運維腳本、UX 指令系統 |
| 2 | 增加型別擴展 (Grammy Context)、佇列優先級、健康檢查詳細模式 |
| 3 | Config Zod 驗證、Circuit Breaker 模式、事件過濾機制 |
| 4 | Claude Code 整合深化、Session 持久化至 Supabase、架構優化圖 |
| 5 | 安全性深化（Prompt Injection 防護、CSP Headers）、威脅模型分析 |
| 6 | 效能基準測試設計、P95 監控、Metrics API endpoint |
| 7 | Dashboard UX 優化（LiveFeed 過濾、Goals 拖放排序、趨勢圖） |
| 8 | 記憶系統優化（智慧上下文截取、相似度去重） |
| 9 | 可觀測性完善（Correlation ID、Prometheus metrics、OpenTelemetry） |
| 10 | 最終整合、優先級排序、實作路線圖 |

---

## 最終優先級排序

### P0 - MVP 必須 (Week 1-2)

| 項目 | 檔案 | 說明 |
|------|------|------|
| Gateway 核心 | `src/gateway/index.ts` | 協調所有組件，Graceful Shutdown |
| Claude Bridge | `src/gateway/claude-bridge.ts` | spawn + stream-json 解析 + 請求佇列 |
| Session Store | `src/gateway/session-store.ts` | TTL 管理 + 輪換機制 |
| Event Bus | `src/gateway/event-bus.ts` | 事件廣播到 Dashboard |
| Telegram Bot | `src/telegram/index.ts` | Grammy 設定 |
| Message Handler | `src/telegram/handlers/message.ts` | 打字指示器 + 回應處理 |
| Commands | `src/telegram/handlers/commands.ts` | /help, /status, /memory, /clear |
| Auth Middleware | `src/telegram/middleware/auth.ts` | 白名單驗證 |
| Dashboard API | `src/dashboard/api/index.ts` | Hono server |
| WebSocket | `src/dashboard/websocket.ts` | Live Feed 推送 |
| Dashboard Page | `src/dashboard/web/app/page.tsx` | 主頁面 |
| Live Feed | `src/dashboard/web/components/LiveFeed.tsx` | 即時事件串流 |
| Types | `src/types/index.ts` | 核心型別定義 |
| Config | `src/utils/config.ts` | Zod 環境變數驗證 |

### P1 - MVP 建議 (Week 2-3)

| 項目 | 檔案 | 說明 |
|------|------|------|
| Memory Service | `src/memory/index.ts` | 記憶服務入口 |
| Supabase Client | `src/memory/supabase.ts` | 資料庫連接 |
| Embeddings | `src/memory/embeddings.ts` | OpenAI + LRU 快取 |
| Semantic Search | `src/memory/search.ts` | 語意搜尋 |
| Memory MCP | `src/mcp/memory-server.ts` | remember/recall 工具 |
| Goals API | `src/dashboard/api/routes/goals.ts` | CRUD |
| Health API | `src/dashboard/api/routes/health.ts` | 健康檢查 |
| Errors | `src/utils/errors.ts` | 統一錯誤處理 |
| Monitoring | `src/utils/monitoring.ts` | 告警系統 |
| DB Schema | `db/schema.sql` | Supabase DDL |

### P2 - 穩定化 (Week 3-4)

| 項目 | 檔案 | 說明 |
|------|------|------|
| Circuit Breaker | `src/gateway/circuit-breaker.ts` | 容錯機制 |
| Metrics | `src/utils/metrics.ts` | P95 監控 |
| Validation | `src/utils/validation.ts` | Zod schemas |
| Unit Tests | `tests/unit/**/*.test.ts` | 核心邏輯測試 |
| CI Pipeline | `.github/workflows/ci.yml` | GitHub Actions |

### P3 - 優化 (Week 4+)

| 項目 | 檔案 | 說明 |
|------|------|------|
| Tracing | `src/utils/tracing.ts` | OpenTelemetry |
| Memory Stats | `src/dashboard/web/components/MemoryStats.tsx` | 趨勢圖 |
| E2E Tests | `tests/e2e/**/*.spec.ts` | Playwright |
| Deduplication | `scripts/deduplicate-memories.ts` | 記憶去重 |

---

## 關鍵技術決策

| 決策點 | 選擇 | 理由 |
|--------|------|------|
| AI 核心 | Claude Code (headless) | `--output-format stream-json` 串流事件到 Dashboard |
| Runtime | Bun | 更快啟動、內建 TypeScript |
| Telegram | Grammy | TypeScript 優先、成熟生態 |
| 資料庫 | Supabase (PostgreSQL + pgvector) | 免費額度大方、內建向量搜尋 |
| 向量嵌入 | OpenAI text-embedding-3-small | $0.02/1M tokens |
| 進程管理 | PM2 | 自動重啟、日誌管理 |
| Dashboard | Next.js + Hono | 快速開發、Vercel 免費部署 |
| 部署 | Hetzner VPS | Claude Code CLI 需要系統級安裝 |

---

## 架構圖 (迭代 4 優化後)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Gateway (優化版)                              │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Rate Limiter │→│ Circuit      │→│ Claude       │          │
│  │              │  │ Breaker      │  │ Bridge       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         ↑                                    │                   │
│         │                                    ▼                   │
│  ┌──────────────┐                   ┌──────────────┐          │
│  │ Session      │←──────────────────│ Event Parser │          │
│  │ Store        │                   │ (streaming)  │          │
│  └──────────────┘                   └──────────────┘          │
│         │                                    │                   │
│         ▼                                    ▼                   │
│  ┌──────────────┐                   ┌──────────────┐          │
│  │ Supabase     │                   │ Event Bus    │          │
│  │ (持久化)     │                   │ (過濾+廣播)  │          │
│  └──────────────┘                   └──────────────┘          │
│                                              │                   │
│              ┌───────────────┬───────────────┤                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Telegram    │  │  Dashboard   │  │  Metrics     │          │
│  │    Bot       │  │  WebSocket   │  │  (Prometheus)│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 成本估算

| 服務 | 預估成本/月 |
|------|-------------|
| Claude Code Max Plan | $100 |
| OpenAI Embeddings | $2-5 |
| Supabase (Free) | $0 |
| Hetzner VPS (CX22) | $5 |
| 網域 (可選) | $0-1 |
| **總計** | **$107-111** |

---

## 驗證清單

### 功能驗證
- [ ] Telegram 發訊息 → Claude 回應 → 收到回覆
- [ ] 打字指示器在回應期間顯示
- [ ] /help、/status、/memory、/clear 指令正常
- [ ] Session 跨訊息維持上下文
- [ ] Session 超時後自動輪換
- [ ] Dashboard 即時顯示 Claude 工具呼叫
- [ ] Dashboard 顯示正確的健康狀態
- [ ] 記憶能夠存取和搜尋
- [ ] Goals CRUD 正常運作

### 安全驗證
- [ ] Dashboard API 需要認證
- [ ] WebSocket 需要 token
- [ ] 只有白名單用戶可以使用 Bot
- [ ] 敏感資料不出現在日誌中
- [ ] 輸入驗證阻擋無效請求
- [ ] Prompt injection 防護生效

### 穩定性驗證
- [ ] PM2 進程崩潰後自動重啟
- [ ] WebSocket 斷線後自動重連
- [ ] Claude 超時有適當處理
- [ ] Supabase 斷線有適當處理
- [ ] Graceful Shutdown 正常運作
- [ ] Circuit Breaker 正常觸發

### 效能驗證
- [ ] Embedding 快取命中率 > 50%
- [ ] 回應時間 P95 < 30 秒
- [ ] Dashboard Live Feed 順暢無卡頓
- [ ] 記憶體使用穩定（無洩漏）
- [ ] WebSocket 延遲 < 100ms

---

## 時程估算

| 階段 | 時間 | 產出 |
|------|------|------|
| P0 實作 | 1-1.5 週 | 可用的 Bot + Dashboard |
| P1 實作 | 1 週 | 記憶系統 + Goals |
| P2 穩定化 | 0.5-1 週 | 穩定生產就緒 |
| P3 優化 | 持續 | 持續改進 |

**總計**: 3-4 週達到生產就緒的 MVP

---

## 完整計劃檔案

詳細的程式碼範例和實作細節請參考：
`/root/.claude/plans/swirling-purring-shell.md`

---

*報告產出日期：2026-02-05*
*迭代次數：10*
*審查面向：9*
