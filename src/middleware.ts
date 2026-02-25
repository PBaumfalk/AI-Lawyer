export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protect all routes except auth, api/auth, onlyoffice, openclaw, ki endpoints, static files, and Next.js internals
    "/((?!login|api/auth|api/onlyoffice|api/openclaw|api/ki|_next/static|_next/image|favicon.ico).*)",
  ],
};
