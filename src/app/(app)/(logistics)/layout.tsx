import type { ReactNode } from "react";

/** Sub-navs (inbound/outbound) must sit outside AppPageShell so they align with the header like listings/catalogues. */
export default function LogisticsSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
