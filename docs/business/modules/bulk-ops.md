# Bulk Operations

**Audience:** Operations, Merchandising, Data teams  
**Plain-language guide to:** Importing and exporting large amounts of data in one step

---

## What are Bulk Operations?

**Bulk Operations** allow team members to create, update, or export many records at once — instead of editing them one by one.

For example, if you need to update the MRP for 500 products, bulk operations let you upload a single spreadsheet rather than making 500 individual changes.

---

## Real-world example: Updating prices after a seasonal review

> **Scenario:** The category team has completed a price review. 340 SKUs need updated MRPs, effective from the start of the next month.

1. The data team exports the current listings to Excel using the Bulk Export function.
2. They update the MRP column for all 340 SKUs in the spreadsheet.
3. They upload the spreadsheet using the Bulk Import function.
4. Zap validates the data — flagging any rows with missing fields or formatting errors.
5. Once approved, all 340 listings are updated in seconds.

Without bulk operations, this would have required hours of manual data entry.

---

## Common uses for Bulk Operations

| Task | How Bulk Ops helps |
|------|--------------------|
| Onboarding new products | Upload hundreds of new SKUs at once via spreadsheet |
| Master SKU creation | Bulk-create warehouse master listings from CSV (Zap-managed SKUs) |
| Price updates | Update MRP or cost price for many SKUs together |
| Bin location changes | Reassign multiple SKUs to new bins after warehouse reorganisation |
| Export for reporting | Download a full filtered set of listings for analysis |
| Stock count upload | Upload physical count results to reconcile stock levels |

---

## How bulk import works — step by step

```
Step 1: Download the template
        (ensures your spreadsheet has the right columns)
             ↓
Step 2: Fill in the template
        (one row per SKU or record)
             ↓
Step 3: Upload the file
        (Zap validates each row)
             ↓
Step 4: Review errors
        (fix any flagged rows before confirming)
             ↓
Step 5: Confirm import
        (all valid rows are processed)
             ↓
Step 6: Download summary
        (shows how many rows succeeded, failed, or were skipped)
```

---

## Important notes on bulk imports

- Always download and use the **official Zap template** — custom column names will cause errors.
- **Master listing import** is create-only: duplicate `sku_id` rows are rejected per row; use the sample CSV under Bulk Operations.
- Zap validates each row before committing — no partial saves that corrupt existing data.
- A full audit trail is kept: who imported what, and when.
- If an import fails, the previous data is untouched.

---

*Back to:* [Business Documentation Index](../index.md)
