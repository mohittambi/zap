# Focus lists — overview

## Responsibility

Curated **shortlists of SKUs** for operational focus: create lists, add/remove items, optional public flag.

**Service:** `focusListsService.ts`. Tables: `focus_lists`, `focus_list_items`.

## API

| Methods | Path |
|---------|------|
| GET, POST | `/focus-lists` |
| GET, PATCH, DELETE | `/focus-lists/[id]` |
| GET, POST, DELETE | `/focus-lists/[id]/items` |

**Code:** `web/src/app/api/focus-lists/**`.
