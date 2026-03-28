import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OutboundPendingInvoicesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle title="Pending Invoices" description="Coming soon." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
          <CardDescription>Pending invoice list will be added here.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
