import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { logAuditEvent } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as NextAuthConfig["adapter"],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Anmeldedaten",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.aktiv) {
          // Log failed login attempt
          logAuditEvent({
            aktion: "LOGIN_FEHLGESCHLAGEN",
            details: {
              email: parsed.data.email,
              grund: !user ? "Benutzer nicht gefunden" : "Konto deaktiviert",
            },
          }).catch(() => {});
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );

        if (!passwordMatch) {
          // Log failed login with wrong password
          logAuditEvent({
            userId: user.id,
            aktion: "LOGIN_FEHLGESCHLAGEN",
            details: {
              email: parsed.data.email,
              grund: "Falsches Passwort",
            },
          }).catch(() => {});
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          kanzleiId: user.kanzleiId,
          kontaktId: user.kontaktId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.kanzleiId = (user as any).kanzleiId;
        // Stamp kontaktId for MANDANT users (portal session)
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
        // Expose kontaktId for MANDANT users
        if (token.role === "MANDANT") {
          (session.user as any).kontaktId = token.kontaktId as string | null;
        }
      }
      return session;
    },
  },
});
