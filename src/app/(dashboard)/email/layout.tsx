/**
 * Email-specific layout that removes outer padding from the dashboard.
 * Full-height email view subtracting header height (4rem).
 */
export default function EmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[calc(100vh-4rem)] -m-6 overflow-hidden">
      {children}
    </div>
  );
}
