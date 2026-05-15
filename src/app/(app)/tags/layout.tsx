import type { ReactNode } from "react";
import { CataloguesSubNav } from "@/components/layout/catalogues-sub-nav";
import { AppPageShell } from "@/components/layout/app-page-shell";

export default function TagsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CataloguesSubNav />
      <AppPageShell>{children}</AppPageShell>
    </>
  );
}
