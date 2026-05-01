# Migration plan — current documentation → sustained system

How to **maintain** the documentation system after this restructure.

## Immediate (done in this initiative)

1. Created **folder taxonomy** under `web/docs/` (`architecture`, `current-system`, `services`, `deployment`, `operations`, `enhancements`, `final`).
2. **Moved** canonical copies of long references (`database-schema`, `web-setup`, `sync-runbook`, eAutomate API reference) into structured paths.
3. **Stubbed** old root paths (`database-schema.md`, `supabase-deployment.md`, `sync-all-eautomate.md`, `eautomate-public-api-reference.md`) to avoid breaking deep links.

## Ongoing (team process)

| Trigger | Action |
|---------|--------|
| New `route.ts` | Update [api-index.md](../architecture/api-index.md) and the relevant `services/*/api.md`. |
| New migration | Update [database-schema.md](../architecture/database-schema.md) and [migrations.md](../deployment/migrations.md). |
| New sync script | Add row to [sync-flows.md](../services/eautomate-integration/sync-flows.md) and [sync-runbook.md](../operations/sync-runbook.md). |
| Major feature | Add subsection to `current-system/workflows.md` or the service `overview.md`. |

## Quarterly

- Review [gaps-analysis.md](../enhancements/gaps-analysis.md) and refresh [roadmap.md](../enhancements/roadmap.md).
- Archive superseded one-off docs into `services/` or delete after confirming no external links.

## See also

- [../README.md](../README.md) — documentation index
