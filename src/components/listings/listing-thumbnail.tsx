"use client";

import * as React from "react";
import { listingImageCandidatesFromRow } from "@/lib/listing-image-url";

export function ListingThumbnail({
  row,
  size = 48,
  className,
}: {
  row: Record<string, unknown>;
  size?: number;
  className?: string;
}) {
  const candidates = React.useMemo(
    () => listingImageCandidatesFromRow(row),
    [row]
  );
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    setIndex(0);
  }, [candidates]);

  const src = candidates[index] ?? null;

  if (!src) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title="Open product image"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote warehouse / eAutomate hosts */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="bg-muted rounded object-cover"
        style={{ width: size, height: size }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setIndex((i) => (i + 1 < candidates.length ? i + 1 : candidates.length));
        }}
      />
    </a>
  );
}
