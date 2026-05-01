# Forms — overview

## Responsibility

**Dynamic forms** defined per `(category, sub_category)` with JSON `form_payload`. Supports reading categories, sub-categories, form definition, today’s submission, and a response by id.

**Service:** `formsService.ts`. Tables: `forms`, `form_submissions`.

## API

| Methods | Path |
|---------|------|
| GET | `/forms/categories` |
| GET | `/forms/categories/[category]` |
| GET | `/forms/categories/[category]/[sub_category]` |
| GET | `/forms/response/[id]` |
| GET | `/forms/today/[id]/[userId]` |

**Code:** `web/src/app/api/forms/**`.

## Note

End-user **submit** flows may be limited compared to read APIs — confirm with product for each deployment.
