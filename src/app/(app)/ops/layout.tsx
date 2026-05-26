import type { ReactNode } from "react";
import { OpsSubNav } from "@/components/layout/ops-sub-nav";
import { AppPageShell } from "@/components/layout/app-page-shell";

export default function OpsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OpsSubNav />
      <AppPageShell>{children}</AppPageShell>
    </>
  );
}
