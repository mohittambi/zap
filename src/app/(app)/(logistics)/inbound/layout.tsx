import type { ReactNode } from "react";
import { AppPageShell } from "@/components/layout/app-page-shell";

export default function InboundSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppPageShell>{children}</AppPageShell>;
}
