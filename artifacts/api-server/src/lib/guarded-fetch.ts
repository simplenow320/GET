import { promises as dnsPromises } from "node:dns";
import net from "node:net";

// ── SSRF-guarded outbound fetch ──────────────────────────────────────────────
//
// Shared by every route that fetches a customer-supplied URL server-side
// (install-check, domain verification). We must NEVER fetch internal
// services, link-local metadata endpoints (169.254.169.254), or private
// RFC1918 ranges. Strategy:
//   • Allow only http/https, reject embedded credentials.
//   • Resolve hostname → IPs and reject if any resolved address is
//     loopback/private/link-local/ULA/multicast/etc. This guards against
//     "internal-host.local" tricks.
//   • Disable redirect following (`redirect: "manual"`) so we don't get
//     bounced from a public host onto an internal one.
//   • Bound body size and total request time.
//
// Known gap (tracked separately, not fixed here): the pre-flight DNS lookup
// and the actual fetch are two round trips, so a malicious resolver can still
// answer them differently (classic DNS rebinding). This mirrors the existing
// install-check behavior rather than introducing a new, weaker guard.
function isPrivateAddr(ip: string): boolean {
  if (net.isIP(ip) === 0) return true;
  if (net.isIP(ip) === 4) {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  // IPv6
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("ff")) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d) — recurse on the embedded v4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddr(mapped[1]);
  return false;
}

export type GuardedFetchResult = {
  fetched: boolean;
  status: number;
  body: string;
  urlError: string | null;
};

/**
 * Fetches `rawUrl` with SSRF hardening applied. Returns `fetched: false` with
 * `urlError` set if the URL is rejected before any network call is made, or
 * if the fetch itself throws (timeout, DNS failure, connection refused).
 */
export async function guardedFetch(
  rawUrl: string,
  opts: { userAgent: string; maxBytes?: number; timeoutMs?: number } ,
): Promise<GuardedFetchResult> {
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 8000;

  let urlError: string | null = null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      urlError = `Unsupported scheme: ${parsed.protocol}`;
    } else if (parsed.username || parsed.password) {
      urlError = "URL must not contain credentials";
    } else {
      const host = parsed.hostname.replace(/^\[|\]$/g, "");
      if (net.isIP(host) !== 0) {
        if (isPrivateAddr(host)) urlError = "Address is private/internal";
      } else {
        const addrs = await dnsPromises.lookup(host, { all: true });
        if (addrs.length === 0) urlError = "DNS lookup returned no addresses";
        else if (addrs.some((a) => isPrivateAddr(a.address))) {
          urlError = "Resolves to a private/internal address";
        }
      }
    }
  } catch (err) {
    urlError = err instanceof Error ? err.message : "Invalid URL";
  }

  if (urlError) {
    return { fetched: false, status: 0, body: "", urlError };
  }

  let body = "";
  let status = 0;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const r = await fetch(rawUrl, {
      signal: controller.signal,
      // Don't follow redirects — a 302 to a private address would bypass the
      // pre-flight DNS check above. Surface the redirect status instead.
      redirect: "manual",
      headers: { "User-Agent": opts.userAgent, Accept: "text/html,*/*" },
    });
    clearTimeout(t);
    status = r.status;
    const reader = r.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let total = 0;
      try {
        while (total < maxBytes) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          body += decoder.decode(value, { stream: true });
        }
      } finally {
        try { await reader.cancel(); } catch { /* ignore */ }
      }
    }
    return { fetched: true, status, body, urlError: null };
  } catch (err) {
    return {
      fetched: false,
      status: 0,
      body: "",
      urlError: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}
