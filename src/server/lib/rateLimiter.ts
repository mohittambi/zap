type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** In-memory sliding-window rate limiter (per serverless instance). */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (existing.count >= maxAttempts) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { allowed: false, retryAfterSec };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/** Test helper — clear all buckets. */
export function resetRateLimiterForTests(): void {
  buckets.clear();
}
