"use client";

import { EmailEmptyState } from "@/components/email/email-empty-state";

interface EmailDetailProps {
  emailId: string | null;
  onSelectEmail: (emailId: string | null) => void;
}

/**
 * Email detail pane with header, sanitized HTML body, attachments, and inline reply.
 * Placeholder — full implementation in Task 2.
 */
export function EmailDetail({ emailId }: EmailDetailProps) {
  if (!emailId) {
    return <EmailEmptyState type="no-selection" />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          E-Mail wird geladen...
        </p>
      </div>
    </div>
  );
}
