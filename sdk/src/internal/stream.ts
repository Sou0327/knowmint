import { KmApiError } from "../errors.js";

/**
 * Default response body size limit (5 MB).
 * Prevents memory exhaustion from malicious or misconfigured servers that
 * return oversized bodies (SSRF / log-injection resistance).
 */
export const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

/**
 * Read a `Response` body as text, rejecting once the body exceeds `maxBytes`.
 *
 * Strategy:
 * 1. Fast path: reject early when Content-Length exceeds the cap.
 * 2. Stream path: read the body in chunks, cancel the reader as soon as the
 *    accumulated size passes the cap. Ignores `content-length` because a hostile
 *    server may lie about it.
 * 3. Fallback (no readable body): fall back to `response.text()` and check the
 *    resulting byte length.
 *
 * Used by MCP / Eliza / AgentKit / CLI / SDK so that every KnowMint HTTP client
 * shares the same defense-in-depth. Keep this function allocation-minimal —
 * it runs on every request.
 */
export async function readResponseText(
  response: Response,
  maxBytes: number = DEFAULT_MAX_RESPONSE_BYTES
): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declared = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new KmApiError(
        `Response too large (declared ${declared} bytes, max ${maxBytes})`,
        response.status
      );
    }
  }

  const body = response.body;
  if (!body) {
    // Fallback for environments where Response.body is unavailable.
    const text = await response.text();
    const len = new TextEncoder().encode(text).byteLength;
    if (len > maxBytes) {
      throw new KmApiError(
        `Response too large (${len} bytes, max ${maxBytes})`,
        response.status
      );
    }
    return text;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        // Fire-and-forget cancel; we already have the information we need.
        reader.cancel().then(() => {}, () => {});
        throw new KmApiError(
          `Response body exceeded ${maxBytes} bytes`,
          response.status
        );
      }
      chunks.push(value);
    }
  } finally {
    // releaseLock is safe even after cancel(); it throws only if the reader is
    // still locked and we haven't released it. Catch defensively for older runtimes.
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  if (chunks.length === 1) {
    return new TextDecoder().decode(chunks[0]);
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
