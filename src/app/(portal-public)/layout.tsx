// Public portal layout — NO auth guard, NO sidebar
// Pages under this route group (login, activate, passwort-vergessen, passwort-reset)
// must be accessible without authentication.
export const dynamic = "force-dynamic";

export default function PortalPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
