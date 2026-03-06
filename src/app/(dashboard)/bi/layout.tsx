import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BI-Dashboard",
};

export default function BiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
