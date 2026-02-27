import type { Server, Socket } from "socket.io";
import { decode } from "next-auth/jwt";
import { createLogger } from "@/lib/logger";

const log = createLogger("socket:auth");

/**
 * Extracts the NextAuth session-token cookie from raw cookie header.
 * Handles both `next-auth.session-token` (dev) and
 * `__Secure-next-auth.session-token` (production) cookie names.
 *
 * Returns { token, cookieName } so we can pass the correct salt to decode().
 */
function extractSessionTokenFromCookies(
  cookieHeader: string | undefined
): { token: string; cookieName: string } | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").reduce(
    (acc, cookie) => {
      const [name, ...rest] = cookie.trim().split("=");
      acc[name] = rest.join("=");
      return acc;
    },
    {} as Record<string, string>
  );

  // Production uses __Secure- prefix; dev uses unprefixed
  if (cookies["__Secure-next-auth.session-token"]) {
    return {
      token: cookies["__Secure-next-auth.session-token"],
      cookieName: "__Secure-next-auth.session-token",
    };
  }

  if (cookies["next-auth.session-token"]) {
    return {
      token: cookies["next-auth.session-token"],
      cookieName: "next-auth.session-token",
    };
  }

  // NextAuth v5 also uses authjs.session-token / __Secure-authjs.session-token
  if (cookies["__Secure-authjs.session-token"]) {
    return {
      token: cookies["__Secure-authjs.session-token"],
      cookieName: "__Secure-authjs.session-token",
    };
  }

  if (cookies["authjs.session-token"]) {
    return {
      token: cookies["authjs.session-token"],
      cookieName: "authjs.session-token",
    };
  }

  return null;
}

/**
 * Install authentication middleware on Socket.IO server.
 *
 * Authentication flow:
 * 1. Cookie-based: extract NextAuth session-token from cookie header (same-origin)
 * 2. Decode using NextAuth v5's decode() (JWE encrypted tokens, NOT plain JWT)
 *
 * On success, populates `socket.data` with userId, role, kanzleiId.
 * On failure, rejects with a German error message.
 */
export function setupSocketAuth(io: Server): void {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    log.warn("NEXTAUTH_SECRET not set -- Socket.IO auth will reject all connections");
  }

  io.use(async (socket: Socket, next) => {
    if (!secret) {
      return next(new Error("Server-Konfigurationsfehler"));
    }

    // Extract session token from cookies
    const extracted = extractSessionTokenFromCookies(
      socket.handshake.headers.cookie
    );

    if (!extracted) {
      log.debug("Connection rejected: no session token cookie found");
      return next(new Error("Authentifizierung erforderlich"));
    }

    try {
      // Decode using NextAuth v5's decode() which handles JWE decryption.
      // The 'salt' parameter must match the cookie name used by NextAuth.
      const decoded = await decode({
        token: extracted.token,
        secret,
        salt: extracted.cookieName,
      });

      if (!decoded || !decoded.sub) {
        log.debug("Connection rejected: token decoded but no subject");
        return next(new Error("Ungueltiges Token"));
      }

      socket.data.userId = decoded.sub;
      socket.data.role = (decoded as any).role ?? null;
      socket.data.kanzleiId = (decoded as any).kanzleiId ?? null;

      log.debug({ userId: decoded.sub, role: (decoded as any).role }, "Socket authenticated");
      next();
    } catch (err) {
      log.debug({ err }, "Token decode failed");
      return next(new Error("Ungueltiges Token"));
    }
  });
}
