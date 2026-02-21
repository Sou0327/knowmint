import { promises as dns } from "node:dns";

// ── IPv6 full-expansion ────────────────────────────────────────────────────

/**
 * Expand any IPv6 address string (including compressed `::` and IPv4-embedded
 * forms like `::ffff:127.0.0.1` or `::7f00:1`) to a 16-element byte array.
 * Returns null if the input is malformed.
 */
function expandIPv6(raw: string): number[] | null {
  let addr = raw.trim().toLowerCase();

  // Handle IPv4-embedded suffix (dotted-decimal in last 32 bits)
  // e.g. "::ffff:127.0.0.1" or "64:ff9b::192.0.2.1"
  if (addr.includes(".")) {
    const lastColon = addr.lastIndexOf(":");
    const ipv4Part = addr.slice(lastColon + 1);
    const ipv4Parts = ipv4Part.split(".");
    // Strict: 4 non-empty decimal parts, each 0–255
    if (
      ipv4Parts.length !== 4 ||
      ipv4Parts.some((p) => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255)
    ) {
      return null;
    }
    const ipv4Octets = ipv4Parts.map(Number);
    const w1 = (ipv4Octets[0] << 8) | ipv4Octets[1];
    const w2 = (ipv4Octets[2] << 8) | ipv4Octets[3];
    addr =
      addr.slice(0, lastColon + 1) +
      w1.toString(16) +
      ":" +
      w2.toString(16);
  }

  // Split on "::" to detect compressed form
  const halves = addr.split("::");
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  // Number of all-zero groups injected by "::"
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && left.length !== 8)) return null;

  const groups = [
    ...left,
    ...Array<string>(missing).fill("0"),
    ...right,
  ];
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    const val = parseInt(group, 16);
    bytes.push((val >> 8) & 0xff, val & 0xff);
  }
  return bytes; // always 16 elements
}

// ── Private IPv4 helper ────────────────────────────────────────────────────

function isPrivateIpv4(a: number, b: number, c: number): boolean {
  if (a === 0) return true;                              // 0.0.0.0/8
  if (a === 10) return true;                             // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true;    // 100.64.0.0/10 CGNAT
  if (a === 127) return true;                            // 127.0.0.0/8
  if (a === 169 && b === 254) return true;              // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 2) return true;    // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 168) return true;              // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 bench
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true;  // 203.0.113.0/24 TEST-NET-3
  if (a >= 224) return true;                            // 224+/4 multicast + reserved
  return false;
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Returns true if the given IP address falls in a private/reserved range.
 *
 * IPv6 is fully expanded to 16 bytes before comparison, so all notations
 * (compact, expanded, IPv4-embedded dotted-decimal and hex) are handled
 * correctly, including edge cases like `::7f00:1` or `::ffff:0:7f00:1`.
 *
 * Covered ranges:
 *   IPv4: 0/8, 10/8, 100.64/10 (CGNAT), 127/8, 169.254/16, 172.16/12,
 *         192.0.2/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24,
 *         224+/4 (multicast + reserved)
 *   IPv6: ::/128, ::1/128, ff00::/8 (multicast), fc00::/7 (ULA),
 *         fe80::/10 (link-local), fec0::/10 (site-local, deprecated),
 *         ::ffff:0:0/96 (IPv4-mapped), ::/96 (IPv4-compatible, deprecated)
 */
export function isPrivateIp(ip: string): boolean {
  const trimmed = ip.trim();

  // ── IPv6 ──────────────────────────────────────────────────────────────────
  if (trimmed.includes(":")) {
    const bytes = expandIPv6(trimmed);
    if (!bytes) return true; // malformed → treat as private (fail-safe)

    // Unspecified :: or loopback ::1
    if (bytes.every((b) => b === 0)) return true; // ::/128
    if (bytes.slice(0, 15).every((b) => b === 0) && bytes[15] === 1) return true; // ::1

    // Multicast: ff00::/8
    if (bytes[0] === 0xff) return true;

    // ULA: fc00::/7  (first byte 0xfc or 0xfd)
    if ((bytes[0] & 0xfe) === 0xfc) return true;

    // link-local: fe80::/10  (bytes[0]=0xfe, bytes[1] high-bits 0b10xxxxxx)
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;

    // site-local (deprecated): fec0::/10
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return true;

    // IPv4-mapped: ::ffff:0:0/96  (bytes 0-9 = 0x00, bytes 10-11 = 0xff)
    if (
      bytes.slice(0, 10).every((b) => b === 0) &&
      bytes[10] === 0xff &&
      bytes[11] === 0xff
    ) {
      return isPrivateIpv4(bytes[12], bytes[13], bytes[14]);
    }

    // IPv4-compatible (deprecated): ::/96  (bytes 0-11 = 0x00)
    if (bytes.slice(0, 12).every((b) => b === 0)) {
      return isPrivateIpv4(bytes[12], bytes[13], bytes[14]);
    }

    return false;
  }

  // ── IPv4 ──────────────────────────────────────────────────────────────────
  const parts = trimmed.split(".");
  // Strict check: exactly 4 parts, each a non-empty decimal integer 0–255.
  // Rejects empty octets ("1..1.1"), leading zeros ("01.2.3.4" → ambiguous),
  // hex ("0xff"), exponential notation ("1e1"), and out-of-range values.
  if (
    parts.length !== 4 ||
    parts.some((p) => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255)
  ) {
    return true; // malformed → treat as private (fail-safe)
  }
  const [a, b, c] = parts.map(Number);
  return isPrivateIpv4(a, b, c);
}

// ── SSRF URL check ─────────────────────────────────────────────────────────

/**
 * Result type for SSRF URL check.
 * Distinguishes between permanent rejections and transient DNS errors.
 */
export type SsrfCheckResult =
  | { safe: true; resolvedIp: string; family: 4 | 6 }
  | {
      safe: false;
      reason:
        | "invalid_url"
        | "private_ip"
        | "dns_notfound" // NXDOMAIN など — ユーザー起因のDNS解決失敗
        | "dns_error"; // EAI_AGAIN など — 一時的なDNS障害
    };

/**
 * Validate a URL as a safe public HTTPS endpoint.
 * Resolves all DNS records and verifies each resolved IP is non-private.
 * Returns a structured result distinguishing permanent vs transient failures.
 */
export async function checkPublicUrl(urlStr: string): Promise<SsrfCheckResult> {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return { safe: false, reason: "invalid_url" };
  }

  if (u.protocol !== "https:") return { safe: false, reason: "invalid_url" };
  if (u.username || u.password) return { safe: false, reason: "invalid_url" };

  const host = u.hostname;

  // IP literal — check directly without DNS lookup
  if (/^[\d.]+$/.test(host) || host.startsWith("[")) {
    const ip = host.startsWith("[") ? host.slice(1, -1) : host;
    return isPrivateIp(ip)
      ? { safe: false, reason: "private_ip" }
      : { safe: true, resolvedIp: ip, family: ip.includes(":") ? 6 : 4 };
  }

  // Hostname — resolve all A/AAAA records
  let results: { address: string; family: number }[];
  try {
    results = await dns.lookup(host, { all: true });
  } catch (err) {
    // ユーザー起因（NXDOMAIN / typo）は dns_notfound で返す
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "EAI_NONAME") {
      return { safe: false, reason: "dns_notfound" };
    }
    // その他の一時的 DNS 障害
    return { safe: false, reason: "dns_error" };
  }

  if (results.length === 0) {
    return { safe: false, reason: "dns_error" };
  }

  // All resolved IPs must be public
  for (const { address } of results) {
    if (isPrivateIp(address)) {
      return { safe: false, reason: "private_ip" };
    }
  }

  // Return the first resolved IP for use in connection pinning
  const first = results[0];
  return {
    safe: true,
    resolvedIp: first.address,
    family: first.family as 4 | 6,
  };
}

/**
 * Convenience wrapper for backward compatibility.
 * @deprecated `checkPublicUrl` を直接使用してください。このラッパーは将来削除されます。
 */
export async function isPublicUrl(urlStr: string): Promise<boolean> {
  const result = await checkPublicUrl(urlStr);
  return result.safe;
}
