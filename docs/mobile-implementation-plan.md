# Mobile App — Production-Ready Feature Completion

**Status:** Implementation in progress (2026-05-07)

---

## Background

The web app has full GRN lifecycle, debit note management, accounts/audit workflows, and outbound invoice operations. The mobile app is read-only — all inbound screens are paginated list wrappers with no detail views, no actions, and no status updates. The outbound side has detail screens but is missing invoice upload/download. Approximately 60% of web features are absent from mobile.

---

## Already Working on Mobile

- Auth: login, token storage (Keychain), `/api/auth/me` check
- Inbound list screens (GRNs, POs, Vendors, SKU-Wise, Pending Audits, Pending Invoice Collection, Pending DCN) — read-only
- Outbound PO list + detail (4 tabs), consignment list + detail, add-box, items
- Listings, inventory, bins, warehouses, catalogues, forms, labels, focus lists
- Shared UI: `Screen`, `RecordRow`, `AppButton`, `AppSearchBar`, `EmptyState`, `ErrorBanner`, `StatusBadge`, `BottomSheet`, `AppTextField`, `AppTabBar`

---

## Gap Summary

| Area | Mobile Status | Phase |
|---|---|---|
| GRN Detail screen | Missing | 1 |
| Close GRN action | Missing | 2 |
| Audit status update | Missing | 2 |
| Invoice collection update | Missing | 2 |
| Accounts approve/reject | Missing | 2 |
| Pending Accounts screen | Missing | 3 |
| Debit note view + DN assignment | Missing | 4 |
| CN copy upload + download | Missing | 4 |
| Tally CSV export | Missing | 4 |
| eAutomate DCN assignment + upload | Missing | 5 |
| Outbound consignment invoice upload | Missing | 6 |
| Outbound consignment invoice download | Missing | 6 |
| `patchJson` on ApiClient | Missing | 0A |
| Document picker for uploads | Missing | 0B |
| Tests (screens, repos, actions) | 1 file | 7 |

---

## Phase 0 — Foundation

**0A — Add `patchJson` to ApiClient**
File: `mobile/src/shared/api/client.ts`

Add `async patchJson<T>(path, body?, init?)` following the same pattern as `postJson` with `method: 'PATCH'`. Required by every status update.

**0B — Add `react-native-document-picker`**
```
cd mobile && yarn add react-native-document-picker
cd ios && pod install
```
Used for selecting PDF/JPG files. Returns `{ uri, name, type, size }`.

**0C — Extend navigation types**
File: `mobile/src/app/navigation/types.ts`

Add to `InboundStackParamList`:
```typescript
InboundGrnDetail: { grnId: number; vendorName?: string; poNumber?: string };
InboundPendingAccounts: undefined;
```

File: `mobile/src/app/navigation/RootNavigator.tsx`

Register both new screens in `InboundStack()`.

**0D — Make GRN list rows tappable**
File: `mobile/src/shared/ui/InboundPaginatedList.tsx`

Add optional `onRowPress?: (item: Record<string, unknown>) => void` prop. When provided, each `RecordRow` gets the `onPress` prop.

File: `mobile/src/features/inbound/GrnsScreen.tsx`

Pass `onRowPress` → `navigation.navigate('InboundGrnDetail', { grnId: Number(item.grn_id ?? item.id) })`.

---

## Phase 1 — GRN Detail Screen

**New file:** `mobile/src/features/inbound/InboundGrnDetailScreen.tsx`

Uses `AppTabBar` for 4 tabs. Data from `useQuery` → `fetchGrnDetail(api, grnId)` → `GET /api/inbound/grns/[grnId]/details`.

Tabs:
1. **Summary** — GRN ID, vendor, PO number, status badges, quantities (invoice/accepted/rejected/shortage), action buttons (Phase 2)
2. **Items** — `FlatList` of GRN line items (SKU ID, description, invoice qty, accepted qty, rejected qty, unit price)
3. **Documents** — uploaded files list; "Download" → `Linking.openURL`
4. **Debit Note** — renders `InboundGrnDebitNoteTab` (Phase 4)

**Repository:** add `fetchGrnDetail(api, grnId)` → `api.getJson<Record<string, unknown>>('inbound/grns/${grnId}/details')` to `inbound.repository.ts`.

---

## Phase 2 — GRN Status Actions

**New file:** `mobile/src/features/inbound/InboundGrnActions.tsx`

Component rendered in GRN detail Summary tab. All actions use `useMutation` + `queryClient.invalidateQueries(['inbound', 'grn', grnId])` on success.

Actions:
- **Close GRN** — visible when `grn_status === 'OPEN'` → `POST /api/inbound/grns/[grnId]/close`
- **Mark Audit Complete** — visible when `grn_audit_status !== 'CLOSED'` and `grn_status === 'CLOSED'` → `PATCH /api/inbound/grns/[grnId]` with `{ grn_audit_status: 'CLOSED', grn_audit_by: userEmail }`. **Web parity gap:** on web, this action requires the **`admin` role**, shows a **Confirm Audit** dialog, and locks GRN lines after audit. Mobile should gate the button to admins and add confirmation before implementing.
- **Mark Invoice Collected** — visible when `grn_audit_status === 'CLOSED'` and not yet COLLECTED → `PATCH` with `{ grn_invoice_collection_status: 'COLLECTED' }`
- **Approve Accounts** — gated by accounts permission → `PATCH` with `{ accounts_status: 'APPROVED' }`
- **Reject Accounts** — gated by accounts permission → `PATCH` with `{ accounts_status: 'REJECTED' }`

All buttons: `AppButton` with loading state. Destructive actions show `Alert.alert` confirmation first.

**Repository additions:**
```typescript
closeGrn(api, grnId) → api.postJson(`inbound/grns/${grnId}/close`)
updateGrnStatus(api, grnId, patch) → api.patchJson(`inbound/grns/${grnId}`, patch)
```

---

## Phase 3 — Pending Accounts Screen

**New file:** `mobile/src/features/inbound/InboundPendingAccountsScreen.tsx`

Uses `InboundPaginatedList` with `apiPath="inbound/pending-accounts/grns"`, `onRowPress` navigates to `InboundGrnDetail`.

**InboundHomeScreen.tsx** — add metric card entry:
```typescript
{
  label: 'Pending Accounts',
  subtitle: 'GRNs awaiting accounts approval',
  colorKey: 'danger',
  route: 'InboundPendingAccounts',
  apiPath: 'inbound/pending-accounts/grns?page=1&count=1',
  queryKey: ['inbound', 'home', 'pending-accounts-count'] as const,
}
```

---

## Phase 4 — Debit Note Workflow

**New file:** `mobile/src/features/inbound/InboundGrnDebitNoteTab.tsx`

Receives `grnId: number`. Fetches via `useQuery` → `fetchGrnDebitNote(api, grnId)` → `GET /api/inbound/grns/[grnId]/debit-note`.

States:
- **No note:** "No debit note generated" message
- **Note exists:** status badge, DN reference, total debit amount, line items list

Actions:
- **Assign DN Number** (visible when `status === 'DRAFT'` or `'EXPORTED'` and no `dn_number`): `AppTextField` + `AppButton` → `PATCH /api/inbound/grns/[grnId]/debit-note { dn_number }`
- **Upload CN Copy** (visible when `status === 'ISSUED'` and no `cn_copy_file_name`): `DocumentPicker.pickSingle()` → `POST /api/inbound/grns/[grnId]/debit-note/cn-copy`
- **Download CN Copy** (visible when `cn_copy_file_name` set): `GET /api/inbound/grns/[grnId]/debit-note/cn-copy` → `Linking.openURL(url)`
- **Export Tally CSV** (always visible when note exists): build URL with token → `Linking.openURL`

**Repository additions to `inbound.repository.ts`:**
```typescript
fetchGrnDebitNote(api, grnId)
assignDnNumber(api, grnId, dnNumber)
uploadCnCopy(api, grnId, file)
getCnCopyUrl(api, grnId)
```

---

## Phase 5 — eAutomate DCN Actions

In GRN detail Summary tab, show DCN status section:

- **Assign DCN Number** (when `credit_debit_note_number_assignment_status === 'NOT_ASSIGNED'`): `BottomSheet` with `AppTextField` + submit → `PATCH /api/inbound/grns/[grnId]` with assignment fields
- **Upload DCN File** (when `credit_debit_note_upload_status === 'NOT_UPLOADED'`): `DocumentPicker` → `POST /api/inbound/grns/[grnId]/upload-zap?kind=debit_note`

**Repository additions:**
```typescript
assignDcnNumber(api, grnId, dcnNumber)
uploadDcnFile(api, grnId, file)
```

Make rows on `InboundPendingDebitCreditScreen` tappable → navigate to `InboundGrnDetail`.

---

## Phase 6 — Outbound Consignment Invoice

**`OutboundConsignmentDetailScreen.tsx` additions:**

- **Upload Invoice** (visible when `invoice_number_status` set and `invoice_file_name` null): `DocumentPicker` → `POST /api/outbound/consignments/[id]/invoice-upload`
- **Download Invoice** (visible when `invoice_file_name` set): `GET /api/outbound/consignments/[id]/invoice` → `Linking.openURL(url)`

**Repository additions to `outbound.repository.ts`:**
```typescript
uploadConsignmentInvoice(api, consignmentId, file)
getConsignmentInvoiceUrl(api, consignmentId)
```

---

## Phase 7 — Tests

### Test files

| File | What it tests |
|---|---|
| `mobile/__tests__/client.test.ts` | `patchJson` sends PATCH with correct URL, headers, body |
| `mobile/__tests__/inbound.repository.test.ts` | All inbound repository functions call correct API methods + paths |
| `mobile/__tests__/outbound.repository.test.ts` | `uploadConsignmentInvoice`, `getConsignmentInvoiceUrl` |
| `mobile/__tests__/InboundGrnDetailScreen.test.tsx` | Loading, error, data render, Close GRN button visibility |
| `mobile/__tests__/InboundGrnDebitNoteTab.test.tsx` | No-note state, DN input visibility, upload/download buttons |

Run with: `yarn test` inside `mobile/`.

---

## Critical Files

| File | Action |
|---|---|
| `mobile/src/shared/api/client.ts` | Edit: add `patchJson` |
| `mobile/package.json` | Edit: add `react-native-document-picker` |
| `mobile/src/app/navigation/types.ts` | Edit: add `InboundGrnDetail`, `InboundPendingAccounts` |
| `mobile/src/app/navigation/RootNavigator.tsx` | Edit: register new screens |
| `mobile/src/shared/ui/InboundPaginatedList.tsx` | Edit: add `onRowPress` prop |
| `mobile/src/features/inbound/inbound.repository.ts` | Edit: add all new functions |
| `mobile/src/features/inbound/GrnsScreen.tsx` | Edit: pass `onRowPress` for navigation |
| `mobile/src/features/inbound/InboundGrnDetailScreen.tsx` | New |
| `mobile/src/features/inbound/InboundGrnDebitNoteTab.tsx` | New |
| `mobile/src/features/inbound/InboundGrnActions.tsx` | New |
| `mobile/src/features/inbound/InboundPendingAccountsScreen.tsx` | New |
| `mobile/src/features/inbound/InboundHomeScreen.tsx` | Edit: add Pending Accounts metric card |
| `mobile/src/features/outbound/outbound.repository.ts` | Edit: add invoice functions |
| `mobile/src/features/outbound/OutboundConsignmentDetailScreen.tsx` | Edit: add invoice upload + download |
| `mobile/__tests__/client.test.ts` | New |
| `mobile/__tests__/inbound.repository.test.ts` | New |
| `mobile/__tests__/outbound.repository.test.ts` | New |
| `mobile/__tests__/InboundGrnDetailScreen.test.tsx` | New |
| `mobile/__tests__/InboundGrnDebitNoteTab.test.tsx` | New |

---

## Verification Per Phase

| Phase | How to verify |
|---|---|
| 0 | TypeScript compiles; GRN row tap navigates to detail screen |
| 1 | Open GRN list → tap row → 4-tab detail screen loads |
| 2 | OPEN GRN → Close button visible → tap → status = CLOSED |
| 3 | Home screen shows Pending Accounts count; list loads; rows navigate |
| 4 | DRAFT note → assign DN number; upload CN copy; download opens file |
| 5 | Pending DCN row → GRN detail → assign DCN; upload file |
| 6 | Consignment with invoice_number_status → upload; download opens PDF |
| 7 | `yarn test` passes all new test files |
