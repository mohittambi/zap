import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OutboundPartialPoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle title="Partially Created Purchase Orders" description="Coming soon." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Draft POs</CardTitle>
          <CardDescription>Partially created orders will appear here.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
