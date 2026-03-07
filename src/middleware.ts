import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use edge-compatible config only (no Prisma/bcrypt)
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  matcher: [
    // Protect all routes except auth pages, portal public pages, api/auth, portal APIs, onlyoffice, openclaw, ki endpoints, static files, and Next.js internals
    // Note: 2fa-setup-required is excluded so the authorized callback can serve it without redirect loop
    "/((?!login|2fa-setup-required|portal/login|portal/activate|portal/passwort-vergessen|portal/passwort-reset|api/auth|api/portal/activate|api/portal/password-reset|api/onlyoffice|api/openclaw|api/ki|_next/static|_next/image|favicon.ico).*)",
  ],
};
