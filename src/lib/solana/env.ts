/**
 * Server-side Solana env resolver (RP6 B-9).
 *
 * `NEXT_PUBLIC_*` variables are inlined at build time — there is no way to
 * rotate program ids or fee vaults without rebuilding the whole app. The
 * server should therefore prefer runtime secrets (`KM_PROGRAM_ID`,
 * `KM_FEE_VAULT_ADDRESS`) and only fall back to the `NEXT_PUBLIC_*` value
 * so existing deployments keep working while they roll out the new vars.
 *
 * On Cloudflare Workers the per-request `env` binding lives in an
 * `AsyncLocalStorage` keyed by a well-known symbol. Reading from that
 * binding — instead of `process.env` — lets warm isolates pick up secret
 * rotations without a cold start. Outside of Workers the symbol is absent,
 * so we fall through to `process.env`. This mirrors the pattern already used
 * in `src/lib/solana/connection.ts` and `src/lib/x402/index.ts` (see Phase
 * 15/23 notes in MEMORY.md).
 */
export function getServerEnv(key: string): string | undefined {
  const cfCtx = (
    globalThis as Record<symbol, { env?: Record<string, string> } | undefined>
  )[Symbol.for("__cloudflare-context__")];
  if (cfCtx?.env?.[key]) return cfCtx.env[key];
  return process.env[key];
}

/**
 * Resolve a configured address (e.g. KM_PROGRAM_ID) with a `NEXT_PUBLIC_*`
 * legacy fallback. Empty strings are treated as "not set" so a blank env
 * value does not override a populated public var.
 */
export function getServerAddress(
  serverKey: string,
  publicKey: string,
): string | undefined {
  const server = getServerEnv(serverKey)?.trim();
  if (server) return server;
  const fallback = getServerEnv(publicKey)?.trim();
  return fallback ? fallback : undefined;
}
