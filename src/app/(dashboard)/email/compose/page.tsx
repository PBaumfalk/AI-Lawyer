import { redirect } from "next/navigation";
import { emailComposeLink, emailLink } from "@/lib/email/links";

/**
 * Legacy URL /email/compose: composing happens in the inbox (compose popup;
 * replies/forwards inline in the opened mail).
 */
export default async function EmailComposeRedirect({
  searchParams,
}: {
  searchParams: Promise<{ reply?: string; replyAll?: string; forward?: string }>;
}) {
  const { reply, replyAll, forward } = await searchParams;
  const refId = reply || replyAll || forward;
  redirect(refId ? emailLink(refId) : emailComposeLink());
}
