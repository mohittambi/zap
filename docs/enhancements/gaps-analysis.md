# Gaps analysis (as-is → opportunities)

This document tracks **known gaps** between ideal operations and the current system. It complements [../current-system/limitations.md](../current-system/limitations.md).

## Documentation

- Legacy markdown files at `web/docs/*` root coexist with the new tree; **some links** in older READMEs may still point to moved files (stubs redirect).
- **OpenAPI** spec is not generated; the [api-index](../architecture/api-index.md) is hand-maintained.

## Auth

- No **refresh-token** flow for JWT — clients re-login on expiry.
- API key resolution scans bcrypt hashes — may need optimization at very large user counts.

## Sync and integrations

- Full eAutomate sync can take **hours**; failure recovery is largely **manual re-run** with flags.
- **Rate limits** on eAutomate are not centrally enforced in Zap (depends on scripts and backoff in individual fetchers).

## Data quality

- **listings_snapshot** / consignment coverage can be **partial** for some PO formats — label/report flows implement fallbacks but operators may still need uploads.

## Observability

- No first-class **audit trail** for all API mutations beyond domain-specific logs (e.g. outbound PO logs).

## Product / UX

- **Forms:** read paths are stronger than end-user submit flows in some deployments — confirm scope per release.

## See also

- [proposed-features.md](proposed-features.md)
- [roadmap.md](roadmap.md)
