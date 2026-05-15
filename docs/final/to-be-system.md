# To-be system (target vision)

This section describes a **desired end state** for Zap as a documentation-backed target. It is not a commitment date-wise.

## Platform

- **Single developer portal**: all docs under `web/docs/` with generated API reference where possible.
- **Clear SLAs** for sync jobs (expected runtime, retry policy, alerting hooks).

## Architecture

- **Modular domains** remain in `server/services/*` with thin Route Handlers.
- Optional future: **read replicas** for heavy reporting if Postgres becomes the bottleneck.

## Workflows

- **Inbound:** GRN detail always has a clear “last refreshed” provenance; file downloads uniformly from Storage when available.
- **Outbound:** PO workflow actions are **fully local** with explicit status model; eAutomate remains an optional enricher, not a blocker.

## Mobile

- **Zap Ops** covers the top 10 operator journeys with offline-tolerant read paths where feasible.

## See also

- [migration-plan.md](migration-plan.md)
- [../current-system/overview.md](../current-system/overview.md)
