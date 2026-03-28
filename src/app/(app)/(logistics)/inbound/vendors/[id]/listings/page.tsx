"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Legacy URL: same hub as /inbound/vendors/[id] with Listings tab selected.
 */
export default function InboundVendorListingsRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? "");

  React.useEffect(() => {
    router.replace(`/inbound/vendors/${encodeURIComponent(id)}?tab=listings`);
  }, [id, router]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-2 py-4 md:px-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
