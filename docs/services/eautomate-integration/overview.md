# eAutomate integration — overview

## What eAutomate is (in Zap)

**eAutomate** (`web.eautomate.in` by default) is the upstream **reference ERP**. Zap **mirrors** selected entities into PostgreSQL via sync scripts and on-demand ingests, and uses **proxy helpers** (`eautomate-proxy.ts`, `eautomate-session.ts`) for authenticated HTTP.

## Modes of use

| Mode | Description |
|------|-------------|
| **Sync scripts** | `web/scripts/*` — batch pull vendors, GRNs, outbound POs, secondary listings, etc. |
| **Ingest services** | `eautomateGrnDetailsIngestService`, `eautomatePoDetailsIngestService`, `eautomateOutboundPoDetailSyncService` — deep detail snapshots |
| **Reference-only workflows** | Some outbound actions are implemented **locally in Zap** (ack/cancel/reports/labels) so operators are not blocked by upstream HTTP quirks |

## Dependencies

| Env (typical) | Purpose |
|---------------|---------|
| `EAUTOMATE_BASE_URL` | API origin |
| `EAUTOMATE_COOKIE` / bearer | Session |
| `EAUTOMATE_LOGIN_USER_ID` / `EAUTOMATE_LOGIN_PASSWORD` | Auto re-login |

## See also

- [api-reference.md](api-reference.md) — full upstream path catalog
- [sync-flows.md](sync-flows.md) — npm scripts and data flow
- [../../operations/sync-runbook.md](../../operations/sync-runbook.md)
