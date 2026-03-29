import { ConsignmentDetailClient } from "../consignment-detail-client";

export default async function OutboundConsignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConsignmentDetailClient id={id} />;
}
