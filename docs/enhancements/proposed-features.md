# Proposed features and improvements

Non-binding backlog derived from architecture reviews and logistics workflows. Prioritize via [roadmap.md](roadmap.md).

## Platform

- **OpenAPI / typed client** generation from Route Handlers or a Zod schema layer.
- **Structured audit log** table for sensitive mutations (who/when/what JSON patch).

## Inbound

- **Webhook or queue** for GRN status changes instead of poll-only sync (if eAutomate exposes events).
- **Bulk GRN detail refresh** dashboard with progress and per-GRN retry.

## Outbound

- **Stronger consignment ↔ PO reconciliation** reports when line items drift between snapshot sources.
- **Label preview** in-browser before PDF download for large jobs.

## Data

- **Periodic data quality** jobs: orphan FK detection, snapshot freshness alerts.

## Mobile

- Parity with high-traffic web flows identified with ops (GRN scan, PO search).

## See also

- [../final/to-be-system.md](../final/to-be-system.md)
