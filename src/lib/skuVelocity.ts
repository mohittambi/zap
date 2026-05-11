/**
 * Shared SKU-velocity bucket constants + type. Lives outside the service layer
 * so Client Components can import the thresholds without dragging `pg` (and
 * the rest of the server bundle) into the browser chunk.
 *
 * Buckets are based on units sold over the trailing 30 days:
 *   - fast:   ≥ SKU_VELOCITY_FAST_THRESHOLD
 *   - medium: ≥ SKU_VELOCITY_MEDIUM_THRESHOLD (and < FAST)
 *   - slow:   > 0 (and < MEDIUM)
 *   - dead:   0 sold AND available_qty > 0
 */

export const SKU_VELOCITY_FAST_THRESHOLD = 100;
export const SKU_VELOCITY_MEDIUM_THRESHOLD = 20;

export type SkuVelocityBuckets = {
  fast: number;
  medium: number;
  slow: number;
  dead: number;
};
