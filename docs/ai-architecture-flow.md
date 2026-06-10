# AI Assistant — Architecture & Request Flow

A short map of how a request moves through the backend, so anyone can find where
to add or debug something. The backend is **domain-driven**: each feature area
is a self-contained domain with its own routes, controllers, and services.

---

## Big picture

```
Express app (app.ts)
  └─ DomainRegistry registers each domain (DomainModule)
       └─ Domain (e.g. AIAgentDomain)
            ├─ routes.ts      → endpoints mounted at /api/{domain}
            ├─ controllers/   → request handlers (orchestration + business logic)
            └─ services/      → domain logic, tool registries, external clients
  └─ EventBus  → cross-domain pub/sub (e.g. order:completed → rewards)
  └─ Shared PG pool (database-pool.ts) → all repositories extend BaseRepository
```

- Domains never import each other directly — they talk through the **EventBus**.
- Every repository uses the **shared connection pool** (prevents "too many clients").
- DB is snake_case; app code is camelCase.

---

## The AI assistant request flow (the unified assistant)

```
Frontend (chat panel)
   │  POST /api/ai/orchestrate   { messages, attachedImageUrl? }
   ▼
authMiddleware + requireRole(['shop'])      ← JWT → req.user.shopId
   ▼
UnifiedAssistantController.askOrchestrator
   │
   ├─ 1. shopId from JWT (NEVER from the body)        ← security invariant
   ├─ 2. SpendCapEnforcer.canSpend(shopId)            ← block at 100%, downshift model at 70%
   ├─ 3. Build system prompt (cached rules + help corpus + date/timezone + brand name)
   ├─ 4. getOrchestratorTools()  = insights + marketing + orchestrator-own tools
   │
   ├─ 5. Anthropic tool-use loop:
   │       Claude  ──tool_use──►  dispatchUnified(name, input, ctx)
   │                                 │  ctx = { shopId, pool, attachedImageUrl, lastImageUrl }
   │                                 ├─ getOrchestratorOwnToolByName → execute
   │                                 ├─ getInsightsToolByName        → execute
   │                                 └─ getMarketingToolByName       → execute
   │                                       └─ tool.execute(args, ctx) → { data, display? }
   │       Claude  ◄──tool_result── data    (loop until Claude returns final text)
   │
   ├─ 6. Audit each turn → ai_orchestrate_messages ; track spend
   ▼
Response: { reply, toolCalls:[{tool, args, display}], model, ... }
   ▼
Frontend renders prose + one card per toolCall
   (OrchestrateToolCallCard routes on display.kind → insights / marketing / purchase-order card)
```

Key point: **`data` goes back to Claude** (to reason on), **`display` goes to the
frontend** (to render a card). A tool with no `display` just feeds Claude; the
answer comes out as prose.

---

## The tool pattern (how every capability is built)

Each tool is a small object:

```ts
{
  name: string,                 // globally unique across all registries
  description: string,          // Claude reads this to decide when to call it
  inputSchema: {...},           // JSON schema; Anthropic validates args
  execute(args, ctx) => { data, display? }   // ctx = { shopId, pool }
}
```

Tools are grouped into **registries**, each exposing `getXTools()` +
`getXToolByName()`:
- `services/insights/registry.ts` — business-data tools (revenue, customers, inventory…)
- `services/marketing/registry.ts` — audience, draft, send, image tools
- `services/orchestrator/registry.ts` — cross-domain action tools (e.g. restock PO)

The unified assistant simply **merges all three**. Adding a capability = drop a
tool file into a registry + describe it in the system prompt. (See
`reference_unified_orchestrator_extension` for adding a whole new domain.)

---

## The AI surfaces (which endpoint → which controller)

- **`POST /api/ai/orchestrate`** → `UnifiedAssistantController` — the one
  assistant: insights + marketing + images + how-to, in one thread.
- **`POST /api/ai/insights`** → `InsightsController` — standalone Business
  Insights panel (insights tools only).
- **`POST /api/ai/marketing-chat`** → `MarketingChatController` — standalone
  Marketing panel (marketing tools only).
- **`POST /api/ai/images/generate` · `/images/edit`** → image controllers →
  `ImageGenerationService` (kill-switch → spend cap → daily limit → moderation
  → gpt-image-1).
- **`GET/PUT /api/ai/settings`** → `SettingsController` — a shop's own AI
  settings (shop-editable fields).
- **`PUT /api/ai/admin/shop-settings/:shopId`** → `SettingsController` — admin
  gates (AI on/off, follow-ups, **AI images**, monthly budget).
- **Customer messaging** (the Sales Agent that replies to customers) →
  `AgentOrchestrator` — a separate flow inside the same domain, triggered by
  incoming customer messages rather than an owner request.

All shop endpoints are `authMiddleware + requireRole(['shop'])`; the shopId
always comes from the JWT, never the request body.

---

## Where things live (AIAgentDomain)

- `routes.ts` — every `/api/ai/*` endpoint + its auth.
- `controllers/` — one per surface (UnifiedAssistant, Insights, MarketingChat,
  Settings, Spend, image controllers…). They orchestrate: auth → spend check →
  prompt → tool loop → audit → respond.
- `services/` — the tool registries (`insights/`, `marketing/`, `orchestrator/`),
  the model client (`AnthropicClient`), the spend cap (`SpendCapEnforcer`),
  image pipeline (`ImageGenerationService`), and the external OpenAI clients
  (`services/openai/`: image, whisper, tts, moderation).
- Audit tables: `ai_orchestrate_messages`, `ai_insights_messages`,
  `ai_marketing_messages`, `ai_image_generations` — every call is logged.
