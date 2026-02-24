import { InboxLayout } from "@/components/email/inbox-layout";

export const dynamic = "force-dynamic";

/**
 * Email inbox page — renders the three-pane inbox layout.
 * Server component that delegates to the client-side InboxLayout.
 */
export default function EmailPage() {
  return <InboxLayout />;
}
