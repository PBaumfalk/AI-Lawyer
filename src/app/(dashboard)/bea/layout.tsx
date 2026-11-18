import { BeaSessionProvider } from "@/lib/bea/session";

/**
 * All beA pages share one in-memory beA session (software token login).
 * /bea/compose and /bea/[id] use useBeaSession(), which throws outside
 * this provider; as a layout it also survives navigation between the pages.
 */
export default function BeaLayout({ children }: { children: React.ReactNode }) {
  return <BeaSessionProvider>{children}</BeaSessionProvider>;
}
