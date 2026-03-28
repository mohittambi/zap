import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OutboundManageBoxesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle title="Manage Boxes" description="Coming soon." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Boxes</CardTitle>
          <CardDescription>Box management for outbound will be added here.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
