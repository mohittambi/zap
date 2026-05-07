import getPool from "@/server/db";
import { AppError } from "@/server/errors";
import { adjustBinInventoryInTransaction } from "@/server/services/binsService";

export type ReceiptItem = {
  sku_id: string;
  bin_id: string;
  quantity: number;
};

export type ReceiptResult = {
  sku_id: string;
  bin_id: string;
  quantity: number;
  new_quantity: number;
};

export async function receiveIntoInventory(
  grnIdRaw: unknown,
  items: ReceiptItem[],
  receivedBy: string
): Promise<ReceiptResult[]> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("items must be a non-empty array", 400);
  }

  for (const item of items) {
    const qty = Number(item.quantity);
    if (!item.sku_id || !item.bin_id) {
      throw new AppError("Each item must have sku_id and bin_id", 400);
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new AppError(`Invalid quantity for SKU ${item.sku_id}`, 400);
    }
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const grnRes = await client.query(
      `SELECT grn_id, accounts_status, inventory_receipt_status
       FROM inbound_grns WHERE grn_id = $1
       FOR UPDATE`,
      [grnId]
    );
    if (grnRes.rows.length === 0) throw new AppError(`GRN ${grnId} not found`, 404);
    const grn = grnRes.rows[0];
    if (grn.accounts_status !== "APPROVED") {
      await client.query("ROLLBACK");
      throw new AppError("Accounts must be APPROVED before booking inventory", 422);
    }
    if (grn.inventory_receipt_status === "DONE") {
      await client.query("ROLLBACK");
      throw new AppError("Inventory has already been received for this GRN", 422);
    }

    const results: ReceiptResult[] = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      const result = await adjustBinInventoryInTransaction(client, {
        bin_id: item.bin_id,
        sku_id: item.sku_id,
        operation: "ADD",
        quantity: qty,
        user_id: receivedBy,
        movement_type: "GRN_RECEIPT",
      });

      results.push({
        sku_id: item.sku_id,
        bin_id: item.bin_id,
        quantity: qty,
        new_quantity: result.new_quantity,
      });
    }

    await client.query(
      `UPDATE inbound_grns
       SET inventory_receipt_status = 'DONE',
           inventory_receipt_by = $1,
           inventory_receipt_at = NOW(),
           updated_at = NOW()
       WHERE grn_id = $2`,
      [receivedBy, grnId]
    );

    await client.query("COMMIT");
    return results;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
