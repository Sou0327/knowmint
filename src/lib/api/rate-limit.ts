import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ── In-memory fallback (Token Bucket) ──────────────────────────────────────
interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TOKENS = 60; // requests per window (per API key)
const PRE_AUTH_MAX_TOKENS = 120; // requests per window (per IP, pre-auth)
const WINDOW_MS = 60_000; // 1 minute
const MAX_BUCKETS = 10_000; // in-memory フォールバック時の上限（メモリリーク防止）

function memoryCheckRateLimit(
  key: string,
  maxTokens: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    // 上限超過時は新規エントリを拒否（メモリリーク防止）
    if (buckets.size >= MAX_BUCKETS) {
      return { allowed: false, remaining: 0, resetMs: WINDOW_MS };
    }
    bucket = { tokens: maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor((elapsed / WINDOW_MS) * maxTokens);
  if (refill > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }
  const resetMs = WINDOW_MS - (now - bucket.lastRefill);
  if (bucket.tokens <= 0) return { allowed: false, remaining: 0, resetMs };
  bucket.tokens -= 1;
  return { allowed: true, remaining: bucket.tokens, resetMs };
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
  const g = globalThis as typeof globalThis & {
    __rateLimitCleanup?: ReturnType<typeof setInterval>;
  };
  if (!g.__rateLimitCleanup) {
    g.__rateLimitCleanup = setInterval(cleanup, CLEANUP_INTERVAL);
  }
}

// ── Redis (Upstash) ratelimiter ─────────────────────────────────────────────
let redisRatelimiter: Ratelimit | null = null;
let redisPreAuthRatelimiter: Ratelimit | null = null;

function getRedisRatelimiters(): {
  key: Ratelimit | null;
  preAuth: Ratelimit | null;
} {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return { key: null, preAuth: null };
  }
  if (redisRatelimiter && redisPreAuthRatelimiter) {
    return { key: redisRatelimiter, preAuth: redisPreAuthRatelimiter };
  }
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    redisRatelimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(MAX_TOKENS, "1 m"),
      prefix: "km:rl:key",
    });
    redisPreAuthRatelimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(PRE_AUTH_MAX_TOKENS, "1 m"),
      prefix: "km:rl:ip",
    });
    return { key: redisRatelimiter, preAuth: redisPreAuthRatelimiter };
  } catch {
    console.warn(
      "[rate-limit] Failed to initialize Redis ratelimiter, falling back to in-memory"
    );
    return { key: null, preAuth: null };
  }
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function checkRateLimit(
  keyId: string
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const { key: limiter } = getRedisRatelimiters();
  if (limiter) {
    try {
      const { success, remaining, reset } = await limiter.limit(`key:${keyId}`);
      return {
        allowed: success,
        remaining,
        resetMs: Math.max(0, reset - Date.now()),
      };
    } catch {
      console.warn("[rate-limit] Redis error, falling back to in-memory");
    }
  }
  return memoryCheckRateLimit(`key:${keyId}`, MAX_TOKENS);
}

export async function checkPreAuthRateLimit(
  request: Request
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  // Vercel デプロイでは x-real-ip がエッジネットワークにより確実に設定される（推奨パス）。
  // x-real-ip が未設定の環境（ローカル・カスタムプロキシ等）では
  // x-forwarded-for の末尾 IP（直近プロキシが付与）を使う。
  // 注意: プロキシを介す場合、末尾 IP はプロキシ IP になりうるため、
  //       同一プロキシ配下の複数ユーザーが同一バケットを共有する可能性がある。
  //       本番 Vercel 環境では x-real-ip が常に設定されるためこのケースは発生しない。
  const ip =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    "unknown";
  const { preAuth: limiter } = getRedisRatelimiters();
  if (limiter) {
    try {
      const { success, remaining, reset } = await limiter.limit(`ip:${ip}`);
      return {
        allowed: success,
        remaining,
        resetMs: Math.max(0, reset - Date.now()),
      };
    } catch {
      console.warn("[rate-limit] Redis error, falling back to in-memory");
    }
  }
  return memoryCheckRateLimit(`ip:${ip}`, PRE_AUTH_MAX_TOKENS);
}
