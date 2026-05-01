# Zap platform documentation

This folder is the **single entry point** for understanding the Zap system: web app (Next.js + Postgres), mobile client, integrations, and operations.

## How to read these docs

| Audience | Start here |
|----------|----------------|
| **Business stakeholders / leadership** | [business/index.md](business/index.md) — plain-English, no technical knowledge required |
| New engineers | [current-system/overview.md](current-system/overview.md) → [architecture/hld.md](architecture/hld.md) |
| API consumers | [architecture/api-index.md](architecture/api-index.md) → service-specific `services/*/api.md` |
| DB / migrations | [architecture/database-schema.md](architecture/database-schema.md) |
| DevOps / deploy | [deployment/web-setup.md](deployment/web-setup.md), [deployment/env-reference.md](deployment/env-reference.md) |
| Sync / scripts | [operations/sync-runbook.md](operations/sync-runbook.md) |
| Roadmap | [enhancements/roadmap.md](enhancements/roadmap.md), [final/to-be-system.md](final/to-be-system.md) |

## Folder map

```
web/docs/
├── README.md                 ← you are here
├── business/                 ← plain-English docs for stakeholders (start here if non-technical)
│   ├── index.md              ← stakeholder navigation guide
│   ├── platform-overview.md  ← what Zap is and the value it delivers
│   ├── getting-started.md    ← onboarding guide by role
│   ├── roles-and-access.md   ← who can do what
│   ├── modules/              ← one file per business module
│   └── workflows/            ← end-to-end process flows
├── architecture/             ← HLD, API index, DB schema, system design
├── current-system/           ← as-is overview, workflows, limitations
├── services/                 ← one folder per domain (overview + api + data-model where needed)
├── deployment/               ← setup, env, migrations, seeds
├── operations/               ← sync runbooks, Postman
├── enhancements/             ← gaps, proposals, roadmap
└── final/                    ← to-be vision + migration plan
```

## Related documentation outside `web/docs/`

| Location | Contents |
|----------|----------|
| [../README.md](../README.md) | Monorepo quick start |
| [../web/README.md](../README.md) | Web app setup, env, scripts |
| [../mobile/README.md](../../mobile/README.md) | Zap Ops (React Native) |
| [../mobile/docs/](../../mobile/docs/) | Mobile UI / design notes |
| [../docs/eautomate-references.md](../../docs/eautomate-references.md) | Repo-level eAutomate references |
| [../zap-native-app-plan/](../../zap-native-app-plan/) | Native app planning corpus |

## Legacy files in `web/docs/` (root)

Some older one-off docs remain at the root of `web/docs/` for deep links; prefer the **services/** and **architecture/** paths for new content. Notable:

- `auth-flow.md` — superseded by [services/auth/](services/auth/) (see auth overview for JWT + API key model).
- `project-features-modules.md` — superseded by [current-system/overview.md](current-system/overview.md).

When in doubt, search this tree or start from [architecture/api-index.md](architecture/api-index.md).
