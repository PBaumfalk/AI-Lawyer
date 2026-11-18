import { redirect } from "next/navigation";
import { emailLink } from "@/lib/email/links";

/**
 * Legacy URL /email/[id]: emails live in the inbox (EmailNachricht model),
 * which opens the mail from the emailId query parameter.
 */
export default async function EmailDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(emailLink(id));
}
