import type { NextAuthConfig } from "next-auth";
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
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.kanzleiId = (user as any).kanzleiId;
        if ((user as any).role === "MANDANT") {
          token.kontaktId = (user as any).kontaktId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session.user as any).role = token.role as UserRole;
        (session.user as any).kanzleiId = token.kanzleiId as string | null;
        if (token.role === "MANDANT") {
          (session.user as any).kontaktId = token.kontaktId as string | null;
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
