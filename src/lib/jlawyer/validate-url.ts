/**
 * SSRF protection for the j-lawyer base URL.
 *
 * Default policy: https:// URLs with public hostnames only.
 * On-prem installations (plain http, RFC-1918/loopback/link-local hosts)
 * must be explicitly enabled via JLAWYER_ALLOW_PRIVATE_URLS=true.
 */

function isPrivateOrLocalHost(hostname: string): boolean {
  // Strip the FQDN trailing dot — "localhost." and "127.0.0.1." resolve to
  // loopback on system resolvers but would otherwise bypass the checks below.
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;

  // IPv6 literals (WHATWG URL keeps the brackets in hostname)
  if (host.includes(":")) {
    const v6 = host.replace(/^\[|\]$/g, "");
    if (v6 === "::1" || v6 === "::") return true;
    if (/^fe80:/i.test(v6)) return true; // link-local
    if (/^f[cd]([0-9a-f]{2})?:/i.test(v6)) return true; // unique-local fc00::/7, incl. fd::/fc:: shorthand
    // Transition mechanisms with embedded IPv4 (6to4 2002::/16, Teredo
    // 2001:0000::/32) — the embedded address is not inspected, and these
    // prefixes are never legitimate j-lawyer targets, so block outright.
    if (/^2002:/i.test(v6)) return true; // 6to4
    if (/^2001:(0{1,4}:|:)/i.test(v6)) return true; // Teredo 2001::/32
    if (v6.startsWith("::ffff:")) {
      // IPv4-mapped IPv6 — WHATWG URL normalizes the dotted form to hex
      // groups (e.g. [::ffff:127.0.0.1] becomes [::ffff:7f00:1]), so
      // decode the two trailing hex groups back into an IPv4 address.
      const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(v6);
      if (mapped) {
        const hi = parseInt(mapped[1], 16);
        const lo = parseInt(mapped[2], 16);
        const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isPrivateOrLocalHost(ipv4);
      }
      return true; // Unparseable mapped form — fail closed
    }
    return false;
  }

  // IPv4 ranges
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0) return true; // "this" network
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // link-local
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18.0.0/15
    if (a === 192 && b === 0 && Number(m[3]) === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  }
  return false;
}

/**
 * Validate a j-lawyer base URL before it is stored or used.
 * NOTE: hostname-to-IP resolution is not performed — a public hostname that
 * resolves to a private address (DNS rebinding class) is not caught here.
 */
export function validateJLawyerBaseUrl(raw: string): { ok: boolean; error?: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Ungueltige j-lawyer URL" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Nur http(s)-URLs sind erlaubt" };
  }

  // Reject URLs with embedded credentials — fetch() would reject them at
  // request time with a confusing TypeError instead of a validation error.
  if (url.username || url.password) {
    return { ok: false, error: "Zugangsdaten gehoeren nicht in die URL" };
  }

  const allowPrivate = process.env.JLAWYER_ALLOW_PRIVATE_URLS === "true";

  if (isPrivateOrLocalHost(url.hostname) && !allowPrivate) {
    return {
      ok: false,
      error:
        "Private/lokale Hosts sind nicht erlaubt. Fuer On-Premises-Installationen " +
        "JLAWYER_ALLOW_PRIVATE_URLS=true setzen.",
    };
  }

  if (url.protocol === "http:" && !allowPrivate) {
    return {
      ok: false,
      error:
        "Unverschluesseltes http ist nicht erlaubt. Fuer On-Premises-Installationen " +
        "JLAWYER_ALLOW_PRIVATE_URLS=true setzen.",
    };
  }

  return { ok: true };
}
