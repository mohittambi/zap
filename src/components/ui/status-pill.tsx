import { Badge, type badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

const STATUS_ABBREV: Record<string, string> = {
  "acknowledgement pending": "ACK PENDING",
  acknowledgement_pending: "ACK PENDING",
  "partially created": "PARTIAL",
  partially_created: "PARTIAL",
  "invoice pending": "INV PENDING",
  invoice_pending: "INV PENDING",
  "ready to dispatch": "RTD",
  ready_to_dispatch: "RTD",
}

function resolveVariant(raw: string): BadgeVariant {
  const lower = raw.toLowerCase().replaceAll("_", " ")
  switch (lower) {
    case "open":
      return "open"
    case "wip":
      return "wip"
    case "expired":
      return "expired"
    case "pending":
    case "acknowledgement pending":
    case "invoice pending":
      return "pending"
    case "received":
      return "received"
    case "cancelled":
    case "canceled":
      return "cancelled"
    case "processing":
      return "processing"
    default:
      return "outline"
  }
}

function resolveLabel(raw: string): string {
  const lower = raw.toLowerCase()
  if (STATUS_ABBREV[lower]) return STATUS_ABBREV[lower]
  return raw.replaceAll("_", " ").toUpperCase()
}

export function StatusPill({
  status,
  className,
}: {
  status: string | null | undefined
  className?: string
}) {
  if (status == null || status === "") return <span className="text-muted-foreground">—</span>
  return (
    <Badge variant={resolveVariant(status)} className={className}>
      {resolveLabel(status)}
    </Badge>
  )
}
