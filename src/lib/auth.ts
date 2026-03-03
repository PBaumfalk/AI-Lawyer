import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";
import { authConfig } from "./auth.config";

const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as NextAuthConfig["adapter"],
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
});
