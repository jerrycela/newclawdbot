# Dashboard API 整合設計

> 經過 20 次迭代審查後的最終設計

## 背景

Dashboard 前端已完成 70%，主要需要：
1. 連接真實 API（取代 mock data）
2. 實作缺失的 API endpoints

## 現有元件狀態

| 元件 | 狀態 | 需要的工作 |
|------|------|-----------|
| `page.tsx` | ✅ 完成 | 移除 mock data |
| `StatusBar.tsx` | ✅ 完成 | 無 |
| `LiveFeed.tsx` | ✅ 完成 | 無 |
| `ActiveGoals.tsx` | ✅ 完成 | 連接 API + CRUD |
| `MemoryStats.tsx` | ✅ 完成 | 連接 API |
| `ToolUsage.tsx` | ✅ 完成 | 連接 API |
| `useWebSocket.ts` | ✅ 完成 | 無 |

## Phase 1：API 整合（核心）

### 1.1 Goals 連接 `/api/goals`

```typescript
// hooks/useGoals.ts
export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = async () => { ... };
  const createGoal = async (input: CreateGoalInput) => { ... };
  const updateGoal = async (id: string, input: UpdateGoalInput) => { ... };
  const deleteGoal = async (id: string) => { ... };

  return { goals, loading, error, createGoal, updateGoal, deleteGoal, refetch: fetchGoals };
}
```

### 1.2 實作 `/api/stats` 真實資料

需要返回：
- `memoryCount`: 記憶總數
- `goalsCount`: 目標總數
- `todayMessages`: 今日訊息數
- `todayToolCalls`: 今日工具呼叫數
- `topTools`: 最常用工具排行

### 1.3 環境變數配置

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:8081
```

## Phase 2：優化（可延後）

- Memory Search API + UI
- 錯誤處理 + Toast 通知
- 測試

## 優先級排名

| 優先級 | 項目 |
|--------|------|
| 🔴 P0 | Goals 連接 API |
| 🔴 P0 | 實作 `/api/stats` |
| 🔴 P0 | 環境變數配置 |
| 🟡 P1 | Memory Search API |
| 🟡 P1 | 錯誤處理 |
| 🟢 P2 | 測試 |

## 迭代摘要

經過 20 次迭代，主要發現：
- 迭代 2-3: 響應式設計、資料流
- 迭代 4: API 完整性缺口
- 迭代 5-6: UX 與錯誤處理
- 迭代 7: 效能優化
- 迭代 8: 安全性
- 迭代 11: **發現前端已完成 70%**
- 迭代 14: API 連接需求明確
- 迭代 20: 任務重新定義
