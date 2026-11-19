import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use edge-compatible config only (no Prisma/bcrypt)
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  matcher: [
    // Protect all routes except public auth/portal-onboarding pages, auth APIs,
    // machine endpoints with their own auth (OnlyOffice callbacks, OpenClaw),
    // the healthcheck, static files and Next.js internals.
    // Every exclusion must end at a path-segment boundary: the previous bare
    // prefix "api/ki" also exempted /api/ki-chat and /api/ki-entwuerfe.
    // Note: 2fa-setup-required is excluded so the authorized callback can serve it without redirect loop
    "/((?!(?:login|2fa-setup-required|portal/login|portal/activate|portal/passwort-vergessen|portal/passwort-reset|api/auth|api/portal/activate|api/portal/password-reset|api/onlyoffice|api/openclaw|api/health|_next/static|_next/image|favicon\\.ico|brand)(?:/|$)).*)",
  ],
};
