# Insights / Decision Intelligence — API

Base path: `/api/insights`

All routes require authentication. Permissions: `insights:read` (view), `insights:manage` (config, feedback, manual digest). **Admin wildcard only** in default seed — no role grant for warehouse/viewer.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/insights` | read | Ranked worklist (`page`, `count`, `domain`, `severity`, `search_keyword`) |
| GET | `/insights/summary` | read | Hub KPI strip + insight counts |
| GET | `/insights/segmentation` | read | ABC/XYZ matrix + SKU segments |
| GET | `/insights/vendors` | read | Vendor reliability scorecards |
| GET | `/insights/working-capital` | read | Capital tied, DIO, top SKUs |
| GET | `/insights/forecast/[skuId]` | read | Demand forecast + safety stock / EOQ |
| GET | `/insights/config` | read | Insight tuning config |
| PATCH | `/insights/config` | manage | Update weights/thresholds/digest flag |
| POST | `/insights/feedback` | manage | Dismiss / snooze / act on an insight |
| POST | `/insights/digest` | manage or cron bearer | Persist snapshot of current worklist |
| GET | `/insights/snapshots` | read | Paginated digest history |
| GET | `/insights/snapshots/[id]` | read | Snapshot detail + items |

## Insight model

| Field | Type | Notes |
|-------|------|-------|
| `insight_key` | string | Stable hash: `{rule}|{entityType}:{entityId}` |
| `domain` | enum | INVENTORY, PROCUREMENT, SALES |
| `severity` | enum | CRITICAL, WARNING, INFO |
| `priority` | number | `severityWeight × normalizedImpact × urgency` |
| `title`, `rationale`, `recommended_action` | string | Human-readable |
| `impact_value` | number | Revenue/capital/units at risk (proxy) |
| `entity` | object | `{ type, id }` for drill-down |

## Ranking formula

```
priority = severityWeight(severity) × (0.5 + 0.5 × impact/maxImpact) × urgency
```

Feedback with `DISMISSED`, `ACTED`, or active `SNOOZED` suppresses matching `insight_key`.

## Working capital unit cost

Latest GRN line `received_price` (from `inbound_grn_items.raw`), fallback `listings.bulk_price`.

## Scheduled digest

Config: [src/config/schedulers.ts](../../src/config/schedulers.ts) — `insightsDigestScheduler`  
Env: `INSIGHTS_DIGEST_BEARER_TOKEN`, optional `INSIGHTS_DIGEST_ENDPOINT`  
Cron example: `0 6 * * *` daily at 06:00 UTC

## Tests

```bash
cd web
npm run test:unit    # insight-ranking, abc-xyz, vendor score, working capital, forecast
TEST_BASE_URL=http://localhost:3001 npm run test:api -- tests/api/insights-integration.test.mjs
```

Requires migration `074_decision_intelligence.sql`.
