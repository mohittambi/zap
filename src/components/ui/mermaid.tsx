"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

let initialized = false;

async function renderChart(id: string, chart: string): Promise<string> {
  const { default: mermaid } = await import("mermaid");
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      flowchart: { curve: "basis", padding: 16 },
      securityLevel: "strict",
    });
    initialized = true;
  }
  // Remove any leftover element from a prior render with this id
  document.getElementById(id)?.remove();
  const { svg } = await mermaid.render(id, chart);
  return svg;
}

export function MermaidDiagram({
  chart,
  className,
}: Readonly<{ chart: string; className?: string }>) {
  // Stable unique id — random so it survives StrictMode double-mount
  const id = React.useRef<string>("");
  if (!id.current) {
    id.current = `zap-md-${Math.random().toString(36).slice(2, 9)}`;
  }

  const [svg, setSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    setLoading(true);

    renderChart(id.current, chart.trim())
      .then((s) => {
        if (!cancelled) { setSvg(s); setLoading(false); }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Diagram render failed");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [chart]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border bg-muted/30 py-14 text-sm text-muted-foreground", className)}>
        <span className="animate-pulse">Rendering diagram…</span>
      </div>
    );
  }

  if (error) {
    return (
      <pre className={cn("overflow-auto rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive", className)}>
        {error}
      </pre>
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border bg-white p-4 dark:bg-zinc-950 [&_svg]:max-w-full [&_svg]:h-auto",
        className
      )}
      // mermaid returns SVG — securityLevel:strict limits script injection
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg ?? "" }}
    />
  );
}
