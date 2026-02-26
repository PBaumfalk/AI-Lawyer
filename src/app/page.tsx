import { redirect } from "next/navigation";

export default function Home() {
  // Root redirects to dashboard
  redirect("/dashboard");
}
