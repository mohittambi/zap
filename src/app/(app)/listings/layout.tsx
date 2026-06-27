"use client";

import { AppPageShell } from "@/components/layout/app-page-shell";

export default function ListingsSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppPageShell>{children}</AppPageShell>;
}
