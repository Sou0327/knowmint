const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Notify IndexNow-compatible search engines about a new or updated URL.
 * Errors are logged but never thrown.
 * Returns a promise so callers can use waitUntil() in serverless environments.
 */
export async function notifyIndexNow(url: string): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return;

  try {
    const host = new URL(url).origin;
    const params = new URLSearchParams({
      url,
      key,
      keyLocation: `${host}/indexnow-key.txt`,
    });
    const res = await fetch(`${INDEXNOW_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[indexnow] HTTP ${res.status} for ${url}`);
    }
  } catch (err) {
    console.error("[indexnow] notification failed:", err instanceof Error ? err.message : err);
  }
}
