# Activity Log

Admin-only audit trail for authentication, navigation, CRUD, queues, bulk operations, and insights.

## Access control

| Capability | Permission |
|------------|------------|
| View Activity Log UI | Admin (`*:*`) |
| Query `GET /api/admin/activity-log` | Admin (`*:*`) |
| Client navigation tracking | Any authenticated user (writes to log) |
| Create / bulk-create / delete master listings | `listings:create`, `listings:delete`, `bulk:import` (or `*:*`) |

Insights remain super-admin only (`SUPER_ADMIN_EMAILS` allowlist). Activity Log uses the same admin gate as User Management and EAN Mappings (`assertAdmin` / `*:*`).

## Database

Migration `077_activity_log_and_listing_soft_delete.sql`:

- **`activity_log`** — one row per tracked event (`user_id`, `action`, `resource`, `resource_id`, `details` JSONB, request metadata, `created_at`).
- **`listings.is_deleted`** — soft-delete flag with `deleted_at` / `deleted_by`.

Retention: prune rows older than 90 days via `pruneActivityLog()` in `activityLogService.ts` (cron or manual script).

## Server instrumentation

`logActivity()` in `web/src/server/services/activityLogService.ts` is fire-and-forget (errors are logged, never thrown).

Instrumented categories:

| Category | Example actions |
|----------|-----------------|
| Auth | `login`, `login_failed`, `logout`, `api_key_regenerated` |
| Listings | `listing_created`, `listing_updated`, `listing_deleted`, `listings_bulk_imported` |
| Inbound | `grn_created`, `grn_closed`, `grn_audited`, `grn_invoice_collected` |
| Outbound | `outbound_po_created`, `consignment_dispatched` |
| Insights | `forecast_run`, `insight_feedback` |
| Bulk | `bulk_import_secondary`, `listings_bulk_imported` |
| Admin | `user_created`, `user_updated`, `user_deactivated`, `role_permissions_updated` |
| Focus lists | `focus_list_created`, `focus_list_item_added` |
| Navigation | `navigation` (client) |

## Client navigation

`useActivityTracker()` in `web/src/hooks/use-activity-tracker.ts` debounces pathname changes and POSTs to `/api/activity/track`. Wired in `app-shell.tsx` for all authenticated pages.

## Admin UI

**Settings → Activity Log** (`/settings/activity-log`):

- Filterable table (user, action, resource, date range)
- Expandable row details (IP, user agent, full JSON)
- CSV export for current page
- Pagination (100 per page)

## Listing soft-delete

`DELETE /api/listings/sku/:sku_id` (admin only) sets `is_deleted = true`. All listing reads filter `COALESCE(is_deleted, false) = false` unless explicitly including deleted rows for audit.

## Related

- Legacy `admin_audit_log` (migration 070) remains for narrow admin events; new comprehensive trail uses `activity_log`.
