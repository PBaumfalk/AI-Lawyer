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

// Schema for TOTP nonce path (second step after TOTP challenge)
const totpNonceSchema = z.object({
  email: z.string().email(),
  password: z.string().startsWith("TOTP:"),
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
        // TOTP nonce path: called after successful TOTP challenge verification
        const parsedNonce = totpNonceSchema.safeParse(credentials);
        if (parsedNonce.success) {
          const nonce = parsedNonce.data.password.slice(5); // strip "TOTP:" prefix
          const user = await prisma.user.findFirst({
            where: {
              email: parsedNonce.data.email,
              totpNonce: nonce,
              aktiv: true,
            },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              kanzleiId: true,
              kontaktId: true,
              totpNonce: true,
            },
          });

          if (!user) return null;

          // Consume the nonce (one-time use)
          await prisma.user.update({
            where: { id: user.id },
            data: { totpNonce: null },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            kanzleiId: user.kanzleiId,
            kontaktId: user.kontaktId,
            totpEnabled: true, // They just verified TOTP — compliant
          };
        }

        // Normal password path
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
          totpEnabled: user.totpEnabled,
        };
      },
    }),
  ],
});
