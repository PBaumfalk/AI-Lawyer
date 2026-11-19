import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { refreshTokenFromDb } from "@/lib/auth-session";
import { pruefePasswort } from "@/lib/auth-credentials";

/** Login limiter unavailable (Redis): the client shows a "try again shortly" message. */
class AnmeldeschutzNichtVerfuegbar extends CredentialsSignin {
  code = "anmeldeschutz";
}

// Schema for TOTP nonce path (second step after TOTP challenge)
const totpNonceSchema = z.object({
  email: z.string().email(),
  password: z.string().startsWith("TOTP:"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Node runtime only: re-check account state on every session read so that
    // deactivation, role changes and password resets take effect immediately.
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params as any);
      if (params.user || !token) return token;
      return refreshTokenFromDb(token);
    },
  },
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

        // Normal password path (rate-limited; refuses accounts with 2FA)
        const pruefung = await pruefePasswort(credentials, request);
        if (!pruefung.ok && pruefung.grund === "dienst") throw new AnmeldeschutzNichtVerfuegbar();
        return pruefung.ok ? pruefung.user : null;
      },
    }),
  ],
});
