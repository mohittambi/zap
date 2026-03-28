"use client";

import { ListingSubNav } from "@/components/layout/listing-sub-nav";
import { AppPageShell } from "@/components/layout/app-page-shell";

export default function ListingsSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ListingSubNav />
      <AppPageShell>{children}</AppPageShell>
    </>
  );
}
