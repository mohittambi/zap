import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OutboundNewPoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle title="Add New Purchase Order" description="Coming soon." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create PO</CardTitle>
          <CardDescription>This workflow is not wired yet.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
