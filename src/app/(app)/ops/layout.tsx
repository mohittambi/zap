import type { ReactNode } from "react";
import { OpsSubNav } from "@/components/layout/ops-sub-nav";

export default function OpsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <OpsSubNav />
      {children}
    </div>
  );
}
