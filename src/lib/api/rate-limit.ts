interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

const MAX_TOKENS = 60; // requests per window (per API key)
const PRE_AUTH_MAX_TOKENS = 120; // requests per window (per IP, pre-auth)
const WINDOW_MS = 60_000; // 1 minute

function checkRateLimitInternal(
  key: string,
  maxTokens: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor((elapsed / WINDOW_MS) * maxTokens);
  if (refill > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  const resetMs = WINDOW_MS - (now - bucket.lastRefill);

  if (bucket.tokens <= 0) {
    return { allowed: false, remaining: 0, resetMs };
  }

  bucket.tokens -= 1;
  return { allowed: true, remaining: bucket.tokens, resetMs };
}

export function checkRateLimit(keyId: string) {
  return checkRateLimitInternal(`key:${keyId}`, MAX_TOKENS);
}

export function checkPreAuthRateLimit(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return checkRateLimitInternal(`ip:${ip}`, PRE_AUTH_MAX_TOKENS);
}

// Cleanup stale buckets periodically (every 10 minutes)
if (typeof globalThis !== "undefined") {
  const CLEANUP_INTERVAL = 600_000;
  const cleanup = () => {
    const cutoff = Date.now() - WINDOW_MS * 10;
    for (const [key, bucket] of buckets) {
      if (bucket.lastRefill < cutoff) buckets.delete(key);
    }
  };
  // Avoid duplicate intervals in dev hot-reload
  const g = globalThis as unknown as {
    __rateLimitCleanup?: ReturnType<typeof setInterval>;
  };
  if (!g.__rateLimitCleanup) {
    g.__rateLimitCleanup = setInterval(cleanup, CLEANUP_INTERVAL);
  }
}
