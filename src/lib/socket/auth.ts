import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { createLogger } from "@/lib/logger";

const log = createLogger("socket:auth");

interface DecodedToken {
  sub: string;
  role: string;
  kanzleiId: string | null;
  [key: string]: unknown;
}

/**
 * Extracts the NextAuth session-token cookie from raw cookie header.
 * Handles both `next-auth.session-token` (dev) and
 * `__Secure-next-auth.session-token` (production) cookie names.
 */
function extractSessionTokenFromCookies(
  cookieHeader: string | undefined
): string | null {
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
  return (
    cookies["__Secure-next-auth.session-token"] ||
    cookies["next-auth.session-token"] ||
    null
  );
}

/**
 * Install JWT authentication middleware on Socket.IO server.
 *
 * Authentication flow (ordered by priority):
 * 1. Cookie-based: extract NextAuth session-token from cookie header (same-origin)
 * 2. Explicit token: use `socket.handshake.auth.token` (cross-origin / mobile)
 *
 * On success, populates `socket.data` with userId, role, kanzleiId.
 * On failure, rejects with a German error message.
 */
export function setupSocketAuth(io: Server): void {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    log.warn("NEXTAUTH_SECRET not set — Socket.IO auth will reject all connections");
  }

  io.use((socket: Socket, next) => {
    if (!secret) {
      return next(new Error("Server-Konfigurationsfehler"));
    }

    // Priority 1: Cookie-based auth (same-origin)
    const cookieToken = extractSessionTokenFromCookies(
      socket.handshake.headers.cookie
    );

    // Priority 2: Explicit token in handshake auth
    const explicitToken = socket.handshake.auth?.token as string | undefined;

    const token = cookieToken || explicitToken;

    if (!token) {
      log.debug("Connection rejected: no token provided");
      return next(new Error("Authentifizierung erforderlich"));
    }

    try {
      const decoded = jwt.verify(token, secret) as DecodedToken;

      socket.data.userId = decoded.sub;
      socket.data.role = decoded.role;
      socket.data.kanzleiId = decoded.kanzleiId || null;

      log.debug({ userId: decoded.sub, role: decoded.role }, "Socket authenticated");
      next();
    } catch (err) {
      log.debug({ err }, "Token verification failed");
      return next(new Error("Ungueltiges Token"));
    }
  });
}
