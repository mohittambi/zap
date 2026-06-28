"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

/** Super-admin-only section (SUPER_ADMIN_EMAILS allowlist). */
export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { loading, isSuperAdmin } = useAuth();

  React.useEffect(() => {
    if (loading) return;
    if (!isSuperAdmin) {
      router.replace("/listings");
    }
  }, [loading, isSuperAdmin, router]);

  if (loading) return null;
  if (!isSuperAdmin) return null;

  return children;
}
