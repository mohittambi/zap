import Link from "next/link";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OutboundPoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-2 py-4 md:px-4">
      <AppPageTitle
        title={`Purchase order ${id}`}
        description="Detail view will load line items, documents, and fulfillment actions in a later phase."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Placeholder</CardTitle>
          <CardDescription>
            This route is linked from the PO number column on the All Purchase Orders grid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/outbound">Back to All Purchase Orders</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
