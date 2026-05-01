# Current system — limitations and constraints

This is a **living** baseline of known constraints. It is not a bug list; see [../enhancements/gaps-analysis.md](../enhancements/gaps-analysis.md) for improvement tracking.

## Architecture

- **Monolith web app:** Most business logic lives in `server/services` + Route Handlers; there are no separate microservices.
- **eAutomate coupling:** Sync and some file downloads depend on **network availability** and **valid session/cookies** when using upstream APIs.
- **No native event bus:** Cross-module reactions are synchronous (HTTP → DB), not message-driven.

## Data and sync

- **Eventual consistency:** Data ingested from eAutomate can **lag** behind the upstream UI; `synced_at` / `eautomate_synced_at` timestamps record last success.
- **JSONB snapshots:** Large API payloads are stored as **JSONB** for fidelity; reporting often **denormalizes** into tables (e.g. consignment items) when sync jobs run.
- **Migration order:** Schema changes must go through **ordered** `web/migrations/*.sql` files.

## Auth and security

- **JWT expiry:** Clients must handle 401 and re-login (no refresh-token flow in the basic login doc).
- **API keys:** Stored as **bcrypt hashes**; plaintext keys are only shown at creation/refresh time.
- **CORS / hosting:** API is same-origin by default; cross-origin setups need explicit `NEXT_PUBLIC_API_URL` and CORS policy review.

## Operations

- **Seeds are local-only** by convention — do not run destructive seeds against production.
- **Long sync jobs** may require timeouts and rate-limit awareness on eAutomate.

## UI / product

- Some **form submission** UX may be read-heavy vs write-heavy; confirm with product before promising end-user submit flows.
- Very large **GRN/PO detail pages** can carry heavy client bundles; performance depends on payload size and pagination discipline.

## Documentation

- Legacy markdown files at `web/docs/*.md` root may **duplicate** content now organized under `architecture/`, `services/`, and `current-system/`. Prefer the **nested** paths linked from [../README.md](../README.md).

## See also

- [../architecture/database-schema.md](../architecture/database-schema.md)
- [../enhancements/roadmap.md](../enhancements/roadmap.md)
