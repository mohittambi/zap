import type { ReactNode } from "react";
import { OutboundSubNav } from "@/components/layout/outbound-sub-nav";
import { AppPageShell } from "@/components/layout/app-page-shell";

export default function OutboundLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OutboundSubNav />
      <AppPageShell>{children}</AppPageShell>
    </>
  );
}
