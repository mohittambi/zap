# Super Admin Gate

Temporary email allowlist for features that should be visible only to platform owners, not all RBAC admins.

## Environment

```env
SUPER_ADMIN_EMAILS=er.mohittambi@gmail.com
```

- Comma-separated, case-insensitive
- Server-only (never expose via `NEXT_PUBLIC_*`)
- Empty or unset → no user is super admin

## Gated features

| Feature | UI | API |
|---------|----|-----|
| Insights (all) | `/insights/*` | `/api/insights/*` |

## Not gated (regular admin `*:*` still works)

- Activity Log (`/settings/activity-log`, `GET /api/admin/activity-log`)
- User management
- EAN mappings
- Master listing create / delete / bulk import
- Inbound GRN admin actions (audit, accounts, invoice collection)

## Implementation

- `isSuperAdminUser()` / `assertSuperAdmin()` in `web/src/server/rbac.ts`
- Auth payloads include `is_super_admin` from login and `/api/auth/me`
- Client: `useAuth().isSuperAdmin`
- Nav: `superAdminOnly: true` on Insights items; Activity Log uses `adminOnly: true`

## Future

Replace email allowlist with a `super_admin` RBAC role when multiple super admins are needed.
