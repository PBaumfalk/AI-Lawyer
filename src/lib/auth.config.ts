import type { NextAuthConfig } from "next-auth";
import type { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";

/**
 * Edge-compatible auth config (no Prisma, no bcrypt).
 * Used by middleware.ts which runs in the Edge Runtime.
 * Full config with adapter + providers lives in auth.ts.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [], // populated in auth.ts with Credentials provider
  callbacks: {
    authorized({ auth, request }: { auth: any; request: NextRequest }) {
      const url = request.nextUrl;
      const path = url.pathname;
      const under = (base: string) => path === base || path.startsWith(base + "/");
      const isApi = under("/api");

      // Allow the 2FA setup-required page itself (no redirect loop)
      if (path === "/2fa-setup-required") return true;

      if (!auth?.user) {
        // API callers get a machine-readable 401 instead of a login redirect.
        if (isApi) {
          return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
        }
        return false;
      }

      // Mandanten (client accounts) may only use the portal. Without this gate
      // a client who signed in via /login could open the firm's case list and
      // every API that only checks for a session.
      if (auth.user.role === "MANDANT") {
        if (under("/portal") || under("/api/portal")) return true;
        if (isApi) {
          return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
        }
        return Response.redirect(new URL("/portal/dashboard", request.url));
      }

      // The settings area stays reachable for users who must still set up 2FA
      // (the setup-required page links to /einstellungen?tab=sicherheit).
      if (under("/einstellungen")) return true;

      // 2FA enforcement: roles configured via TOTP_REQUIRED_ROLES env var (comma-separated)
      // Edge middleware cannot query the DB — totpEnabled is stored in JWT at login time
      const requiredRolesEnv = process.env.TOTP_REQUIRED_ROLES || "";
      if (requiredRolesEnv && auth.user.role && !auth.user.totpEnabled) {
        const requiredRoles = requiredRolesEnv
          .split(",")
          .map((r: string) => r.trim())
          .filter(Boolean);
        if (requiredRoles.includes(auth.user.role)) {
          return Response.redirect(new URL("/2fa-setup-required", request.url));
        }
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role;
        token.kanzleiId = (user as any).kanzleiId;
        token.totpEnabled = (user as any).totpEnabled ?? false;
        if ((user as any).role === "MANDANT") {
          token.kontaktId = (user as any).kontaktId;
        }
      }
      // Session update after 2FA setup/disable: refresh the stale totpEnabled
      // claim so edge middleware enforcement sees the new state without re-login.
      if (trigger === "update" && typeof (session as any)?.totpEnabled === "boolean") {
        token.totpEnabled = (session as any).totpEnabled;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session.user as any).role = token.role as UserRole;
        (session.user as any).kanzleiId = token.kanzleiId as string | null;
        (session.user as any).totpEnabled = token.totpEnabled as boolean;
        if (token.role === "MANDANT") {
          (session.user as any).kontaktId = token.kontaktId as string | null;
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
