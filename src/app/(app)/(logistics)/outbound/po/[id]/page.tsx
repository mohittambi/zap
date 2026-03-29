import { OutboundPoDetailClient } from "../../outbound-po-detail-client";

export default async function OutboundPoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OutboundPoDetailClient poId={id} />;
}
