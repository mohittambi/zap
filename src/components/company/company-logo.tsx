"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  companyInitials,
  companyLogoSeed,
  COMPANY_LOGO_PALETTE,
  faviconUrlForCompanyName,
  faviconUrlForDomain,
  resolveCompanyLogoUrl,
} from "@/lib/company-brand-logo";

export function CompanyLogo({
  name,
  logoUrl,
  seed,
  size = 20,
  className,
}: {
  name?: string | null;
  logoUrl?: string | null;
  seed?: number;
  size?: number;
  className?: string;
}) {
  const primary = resolveCompanyLogoUrl(name, logoUrl);
  const [src, setSrc] = React.useState<string | null>(primary);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setSrc(primary);
    setFailed(false);
  }, [primary]);

  const initials = companyInitials(name);
  const hue =
    COMPANY_LOGO_PALETTE[
      companyLogoSeed(name ?? "", seed) % COMPANY_LOGO_PALETTE.length
    ];

  if (!name?.trim() && !src) {
    return (
      <span
        className={cn(
          "bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-md text-[10px] font-semibold",
          className
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        ?
      </span>
    );
  }

  if (!src || failed) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white",
          className
        )}
        style={{ width: size, height: size, backgroundColor: hue }}
        title={name ?? undefined}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  const isRemote = src.startsWith("http://") || src.startsWith("https://");

  const handleImageError = () => {
    if (isRemote) {
      const domainMatch = src.match(/domain=([^&]+)/);
      const domain = domainMatch?.[1]
        ? decodeURIComponent(domainMatch[1])
        : null;
      if (domain && !src.includes("sz=64")) {
        setSrc(faviconUrlForDomain(domain).replace("sz=128", "sz=64"));
        return;
      }
      setFailed(true);
      return;
    }
    if (src.startsWith("/brand-logos/") && name?.trim()) {
      const favicon = faviconUrlForCompanyName(name);
      if (favicon && favicon !== src) {
        setSrc(favicon);
        return;
      }
    }
    setFailed(true);
  };

  return (
    <span
      className={cn(
        "bg-background relative inline-flex shrink-0 overflow-hidden rounded-md border border-border/60",
        className
      )}
      style={{ width: size, height: size }}
      title={name ?? undefined}
    >
      {isRemote ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className="size-full object-contain p-0.5"
          onError={handleImageError}
        />
      ) : (
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          className="size-full object-contain p-0.5"
          onError={handleImageError}
        />
      )}
    </span>
  );
}

export function CompanyNameWithLogo({
  name,
  logoUrl,
  companyId,
  size = 20,
  className,
}: {
  name?: string | null;
  logoUrl?: string | null;
  companyId?: number;
  size?: number;
  className?: string;
}) {
  if (!name?.trim()) {
    return <span className={className}>—</span>;
  }
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <CompanyLogo name={name} logoUrl={logoUrl} seed={companyId} size={size} />
      <span className="truncate">{name}</span>
    </span>
  );
}
