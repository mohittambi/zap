import Link from "next/link";
import { ArrowUpRight, Workflow, Zap } from "lucide-react";

import packageJson from "../../../package.json" with { type: "json" };

/** Bumped automatically with package.json. */
const APP_VERSION = packageJson.version;

export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-10 mb-4 flex justify-center px-4">
      <div
        className={[
          "border-primary/15 bg-card/60 supports-[backdrop-filter]:bg-card/40 supports-[backdrop-filter]:backdrop-blur",
          "inline-flex w-fit max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2",
          "rounded-full border px-4 py-2 shadow-sm",
        ].join(" ")}
      >
        {/* Brand */}
        <span className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground inline-flex size-6 items-center justify-center rounded-md">
            <Zap className="size-3.5" strokeWidth={2.5} />
          </span>
          <span className="text-foreground text-xs font-semibold tracking-tight">
            eCraft Zap
          </span>
        </span>

        <span aria-hidden className="text-border">|</span>

        {/* Process Flows pill */}
        <Link
          href="/flows"
          className="text-primary hover:text-primary/80 group inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          <Workflow className="size-3.5" />
          Process Flows
          <ArrowUpRight className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>

        <span aria-hidden className="text-border">|</span>

        {/* Meta */}
        <span className="text-muted-foreground inline-flex items-center gap-2 text-[11px]">
          <span>© {year}</span>
          <span className="text-foreground/80 font-mono">v{APP_VERSION}</span>
        </span>
      </div>
    </footer>
  );
}
