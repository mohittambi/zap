import type { ReactNode } from "react";
import { InboundSubNav } from "@/components/layout/inbound-sub-nav";
import { AppPageShell } from "@/components/layout/app-page-shell";

export default function InboundSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <InboundSubNav />
      <AppPageShell>{children}</AppPageShell>
    </>
  );
}
