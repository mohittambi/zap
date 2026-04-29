"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BuildingIcon, MailIcon, PhoneIcon, MapPinIcon, FileTextIcon } from "lucide-react";

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg border p-3">
      <p className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold">{value || "—"}</p>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="break-words">{value}</p>
      </div>
    </div>
  );
}

export default function VendorDetailPage() {
  const params = useParams();
  const id = str(params.id ?? "");
  const [data, setData] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await apiFetch<Record<string, unknown>>(
          `/api/vendors/${encodeURIComponent(id)}`
        );
        if (!c) setData(res);
      } catch (e) {
        if (!c) toast.error(e instanceof Error ? e.message : "Not found");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => { c = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <p className="text-muted-foreground">Vendor not found.</p>
        <Button asChild variant="outline">
          <Link href="/vendors">← Back to Vendors</Link>
        </Button>
      </div>
    );
  }

  const name = str(data.vendor_name ?? data.name);
  const gstin = str(data.gstin ?? data.gst_number ?? data.gst);
  const email = str(data.email ?? data.contact_email);
  const phone = str(data.phone ?? data.mobile ?? data.contact_phone);
  const address = str(data.address ?? data.address_line1);
  const city = str(data.city);
  const state = str(data.state);
  const pincode = str(data.pincode ?? data.pin_code);
  const contactPerson = str(data.contact_person ?? data.contact_name);
  const notes = str(data.notes ?? data.remarks);
  const status = str(data.status ?? data.is_active);
  const locationParts = [address, city, state, pincode].filter(Boolean);
  const location = locationParts.join(", ");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/vendors">← Vendors</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{name || `Vendor #${id}`}</h1>
            {status ? (
              <Badge
                variant={
                  status === "1" || status === "true" || status.toLowerCase() === "active"
                    ? "default"
                    : "secondary"
                }
              >
                {status === "1" || status === "true" ? "Active" : status === "0" || status === "false" ? "Inactive" : status}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground font-mono text-sm">ID: {id}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={`/vendors/${id}/listings`}>View SKUs</Link>
        </Button>
      </div>

      {/* Identity metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatBox label="Vendor ID" value={id} />
        {gstin ? <StatBox label="GSTIN" value={gstin} /> : null}
        {str(data.vendor_code ?? data.code) ? (
          <StatBox label="Vendor Code" value={str(data.vendor_code ?? data.code)} />
        ) : null}
      </div>

      {/* Contact & location */}
      {(email || phone || location || contactPerson) ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BuildingIcon className="size-4" />
              Contact &amp; Location
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <MetaRow icon={<PhoneIcon className="size-4" />} label="Phone" value={phone} />
            <MetaRow icon={<MailIcon className="size-4" />} label="Email" value={email} />
            <MetaRow icon={<BuildingIcon className="size-4" />} label="Contact person" value={contactPerson} />
            <MetaRow icon={<MapPinIcon className="size-4" />} label="Location" value={location} />
          </CardContent>
        </Card>
      ) : null}

      {/* Notes */}
      {notes ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileTextIcon className="size-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{notes}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Extra fields not captured above */}
      {(() => {
        const known = new Set([
          "id", "vendor_name", "name", "gstin", "gst_number", "gst", "email",
          "contact_email", "phone", "mobile", "contact_phone", "address",
          "address_line1", "city", "state", "pincode", "pin_code", "contact_person",
          "contact_name", "notes", "remarks", "status", "is_active", "vendor_code",
          "code", "created_at", "updated_at",
        ]);
        const extras = Object.entries(data).filter(
          ([k, v]) => !known.has(k) && v != null && String(v).trim() !== ""
        );
        if (!extras.length) return null;
        return (
          <>
            <Separator />
            <div>
              <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
                Additional fields
              </p>
              <dl className="grid gap-2 sm:grid-cols-2">
                {extras.map(([k, v]) => (
                  <div key={k} className="bg-muted/30 rounded-md border px-3 py-2">
                    <dt className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                      {k.replaceAll("_", " ")}
                    </dt>
                    <dd className={cn("mt-0.5 text-sm break-words", typeof v === "number" && "font-mono")}>
                      {String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        );
      })()}
    </div>
  );
}
