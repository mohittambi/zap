import getPool, { query } from '@/server/db';
import { AppError } from '@/server/errors';
import { recordMovement } from '@/server/services/reorderService';

// ── Types ────────────────────────────────────────────────────────────────────

export type OutwardItem = {
  sku_id: string;
  required_qty: number;
};

export type BinAllocation = {
  bin_id: string;
  qty: number;
  available_qty: number;
};

export type SkuSuggestion = {
  sku_id: string;
  description: string | null;
  required_qty: number;
  total_available: number;
  allocated_qty: number;
  shortfall: number;
  bins: BinAllocation[];
};

export type SuggestResult = {
  suggestions: SkuSuggestion[];
  fully_allocatable: boolean;
};

export type CommitBinAllocation = {
  bin_id: string;
  qty: number;
};

export type CommitItem = {
  sku_id: string;
  bin_allocations: CommitBinAllocation[];
};

export type CommitBinResult = {
  bin_id: string;
  deducted: number;
  new_qty: number;
};

export type CommitSkuResult = {
  sku_id: string;
  total_deducted: number;
  bins: CommitBinResult[];
};

// ── Allocation algorithm ─────────────────────────────────────────────────────

type BinStock = { bin_id: string; available_quantity: number };

function allocate(bins: BinStock[], requiredQty: number): BinAllocation[] {
  const sorted = [...bins].sort((a, b) => b.available_quantity - a.available_quantity);
  const allocations: BinAllocation[] = [];
  let remaining = requiredQty;
  for (const bin of sorted) {
    if (remaining <= 0) { break; }
    const take = Math.min(bin.available_quantity, remaining);
    if (take > 0) {
      allocations.push({ bin_id: bin.bin_id, qty: take, available_qty: bin.available_quantity });
      remaining -= take;
    }
  }
  return allocations;
}

// ── suggest ──────────────────────────────────────────────────────────────────

export async function suggestAllocation(items: OutwardItem[]): Promise<SuggestResult> {
  if (items.length === 0) {
    return { suggestions: [], fully_allocatable: true };
  }

  const skuIds = items.map(i => i.sku_id.trim());

  const binsResult = await query(
    `SELECT b.sku_id, b.bin_id, b.available_quantity, l.description
     FROM bins b
     LEFT JOIN listings l ON l.sku_id = b.sku_id
     WHERE b.sku_id = ANY($1) AND b.is_deleted = false AND b.available_quantity > 0
     ORDER BY b.sku_id, b.available_quantity DESC`,
    [skuIds]
  );

  type Row = { sku_id: string; bin_id: string; available_quantity: number; description: string | null };
  const binsBySkuId = new Map<string, Row[]>();
  const descBySkuId = new Map<string, string | null>();

  for (const row of binsResult.rows as Row[]) {
    const list = binsBySkuId.get(row.sku_id) ?? [];
    list.push(row);
    binsBySkuId.set(row.sku_id, list);
    if (!descBySkuId.has(row.sku_id)) {
      descBySkuId.set(row.sku_id, row.description);
    }
  }

  const suggestions: SkuSuggestion[] = items.map(item => {
    const skuBins = binsBySkuId.get(item.sku_id.trim()) ?? [];
    const totalAvailable = skuBins.reduce((s, b) => s + b.available_quantity, 0);
    const bins = allocate(skuBins, item.required_qty);
    const allocatedQty = bins.reduce((s, b) => s + b.qty, 0);
    return {
      sku_id:          item.sku_id.trim(),
      description:     descBySkuId.get(item.sku_id.trim()) ?? null,
      required_qty:    item.required_qty,
      total_available: totalAvailable,
      allocated_qty:   allocatedQty,
      shortfall:       Math.max(0, item.required_qty - allocatedQty),
      bins,
    };
  });

  return {
    suggestions,
    fully_allocatable: suggestions.every(s => s.shortfall === 0),
  };
}

// ── commit ───────────────────────────────────────────────────────────────────

type LockTarget = { sku_id: string; bin_id: string; qty: number };
type LockedRow = { id: number; warehouse_id: number; sku_id: string; bin_id: string; available_quantity: number };

function buildLockTargets(items: CommitItem[]): LockTarget[] {
  return items
    .flatMap(item =>
      item.bin_allocations.map(alloc => ({
        sku_id: item.sku_id.trim(),
        bin_id: alloc.bin_id.trim(),
        qty:    alloc.qty,
      }))
    )
    .sort((a, b) => {
      const skuCmp = a.sku_id.localeCompare(b.sku_id);
      return skuCmp !== 0 ? skuCmp : a.bin_id.localeCompare(b.bin_id);
    });
}

function validateAllocations(
  lockTargets: LockTarget[],
  binMap: Map<string, LockedRow>
): void {
  for (const t of lockTargets) {
    const key = `${t.sku_id}|${t.bin_id}`;
    const row = binMap.get(key);
    if (!row) {
      throw new AppError(`Bin not found: sku=${t.sku_id} bin=${t.bin_id}`, 404);
    }
    if (Number(row.available_quantity) < t.qty) {
      throw new AppError(
        `Over-allocation: sku=${t.sku_id} bin=${t.bin_id} ` +
        `available=${row.available_quantity} requested=${t.qty}`,
        400
      );
    }
  }
}

export async function commitAllocation(
  items: CommitItem[],
  userId: string
): Promise<CommitSkuResult[]> {
  if (items.length === 0) { return []; }

  // Filter out zero-qty allocations — they are no-ops and don't need locking
  const filteredItems: CommitItem[] = items
    .map(item => ({
      ...item,
      bin_allocations: item.bin_allocations.filter(b => b.qty > 0),
    }))
    .filter(item => item.bin_allocations.length > 0);

  if (filteredItems.length === 0) { return []; }

  const lockTargets = buildLockTargets(filteredItems);
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    // Lock each row individually in canonical order to prevent deadlocks
    const binMap = new Map<string, LockedRow>();
    for (const t of lockTargets) {
      const result = await client.query<LockedRow>(
        `SELECT id, warehouse_id, sku_id, bin_id, available_quantity
         FROM bins WHERE sku_id = $1 AND bin_id = $2 AND is_deleted = false
         FOR UPDATE`,
        [t.sku_id, t.bin_id]
      );
      if (result.rows.length === 0) {
        throw new AppError(`Bin not found: sku=${t.sku_id} bin=${t.bin_id}`, 404);
      }
      binMap.set(`${t.sku_id}|${t.bin_id}`, result.rows[0]);
    }

    // Validate all allocations before writing anything
    validateAllocations(lockTargets, binMap);

    // Deduct and record movements
    const results: CommitSkuResult[] = [];
    for (const item of filteredItems) {
      const binResults: CommitBinResult[] = [];
      let totalDeducted = 0;

      for (const alloc of item.bin_allocations) {
        const key = `${item.sku_id.trim()}|${alloc.bin_id.trim()}`;
        const row = binMap.get(key)!;
        const newQty = Number(row.available_quantity) - alloc.qty;

        const updated = await client.query<{ available_quantity: number }>(
          `UPDATE bins SET available_quantity = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING available_quantity`,
          [newQty, row.id]
        );

        await recordMovement({
          client,
          warehouse_id: Number(row.warehouse_id),
          sku_id:       item.sku_id.trim(),
          bin_id:       alloc.bin_id.trim(),
          quantity:     alloc.qty,
          movement_type: 'SALE',
          user_id:      userId,
        });

        binResults.push({
          bin_id:   alloc.bin_id.trim(),
          deducted: alloc.qty,
          new_qty:  Number(updated.rows[0].available_quantity),
        });
        totalDeducted += alloc.qty;
      }

      results.push({ sku_id: item.sku_id.trim(), total_deducted: totalDeducted, bins: binResults });
    }

    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
