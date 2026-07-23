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

      // Allow the 2FA setup-required page itself (no redirect loop)
      if (url.pathname === "/2fa-setup-required") return true;

      // Allow the settings area so enforced users can actually reach the 2FA
      // setup UI (the setup-required page links to /einstellungen?tab=sicherheit).
      // Without this exemption the enforcement redirect loops forever.
      if (url.pathname.startsWith("/einstellungen")) return true;

      // 2FA enforcement: roles configured via TOTP_REQUIRED_ROLES env var (comma-separated)
      // Edge middleware cannot query the DB — totpEnabled is stored in JWT at login time
      const requiredRolesEnv = process.env.TOTP_REQUIRED_ROLES || "";
      if (requiredRolesEnv && auth?.user?.role && !auth?.user?.totpEnabled) {
        const requiredRoles = requiredRolesEnv
          .split(",")
          .map((r: string) => r.trim())
          .filter(Boolean);
        if (requiredRoles.includes(auth.user.role)) {
          return Response.redirect(new URL("/2fa-setup-required", request.url));
        }
      }

      return !!auth;
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
