import { redirect } from "next/navigation";

/**
 * /ki-entwuerfe redirects to /ki-chat (Helena).
 * The KI-Entwuerfe page has been replaced by the Helena chat interface.
 */
export default function KiEntwuerfePage() {
  redirect("/ki-chat");
}
