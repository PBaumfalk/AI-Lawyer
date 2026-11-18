/**
 * Links into the email inbox (/email). The inbox reads these query params
 * (see InboxLayout): emailId opens a mail, compose=1 opens a new message.
 */
export function emailLink(emailId: string): string {
  return `/email?emailId=${encodeURIComponent(emailId)}`;
}

export function emailComposeLink(): string {
  return "/email?compose=1";
}
