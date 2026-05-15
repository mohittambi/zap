"use client";

import * as React from "react";
// react-grid-layout v2 dropped `WidthProvider`; v2 idiom is the
// `useContainerWidth` hook + the `Responsive` component receiving an explicit
// `width` prop. The `@types/react-grid-layout@1.x` types are stale relative
// to the runtime, so we declare just what we use and cast at the boundary.
import {
  Responsive,
  useContainerWidth,
} from "react-grid-layout";
import {
  DASHBOARD_CARD_IDS,
  defaultPositionFor,
  type CardPosition,
  type DashboardCardId,
  type DashboardLayoutV2,
} from "@/lib/dashboard-card-ids";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type RglLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

type ResponsiveProps = {
  className?: string;
  width: number;
  layouts: Record<string, RglLayoutItem[]>;
  breakpoints: Record<string, number>;
  cols: Record<string, number>;
  rowHeight: number;
  margin?: [number, number];
  containerPadding?: [number, number];
  draggableHandle?: string;
  draggableCancel?: string;
  isDraggable?: boolean;
  isResizable?: boolean;
  compactType?: "vertical" | "horizontal" | null;
  onLayoutChange?: (layout: RglLayoutItem[]) => void;
  children?: React.ReactNode;
};

const ResponsiveTyped = Responsive as unknown as React.ComponentType<ResponsiveProps>;

const COLS = { lg: 12, md: 12, sm: 8, xs: 4, xxs: 2 } as const;
const BREAKPOINTS = { lg: 1280, md: 996, sm: 768, xs: 480, xxs: 0 } as const;

export type DashboardGridProps = {
  layout: DashboardLayoutV2;
  /** Map of card ID → rendered card element. */
  renderers: Partial<Record<DashboardCardId, React.ReactNode>>;
  onPositionsChange: (next: Partial<Record<DashboardCardId, CardPosition>>) => void;
  /** When true, the grid becomes read-only (used for shared-layout preview). */
  readOnly?: boolean;
};

function toRglLayout(layout: DashboardLayoutV2): RglLayoutItem[] {
  const out: RglLayoutItem[] = [];
  for (const id of DASHBOARD_CARD_IDS) {
    const cfg = layout.cards.find((c) => c.id === id);
    if (!cfg || cfg.hidden) continue;
    const pos = cfg.pos ?? defaultPositionFor(id);
    out.push({
      i: id,
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      minW: 2,
      minH: 2,
    });
  }
  return out;
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/**
 * On phones, react-grid-layout's touch handlers eat link taps and disrupt
 * vertical scroll. The plan called for a flat fallback on small viewports —
 * here it is: a vertical stack ordered by the saved `pos.y, pos.x` so the
 * layout authoring done on desktop carries over.
 */
function MobileFlatStack({
  layout,
  renderers,
}: {
  layout: DashboardLayoutV2;
  renderers: Partial<Record<DashboardCardId, React.ReactNode>>;
}) {
  const ordered = React.useMemo(() => {
    const visible = DASHBOARD_CARD_IDS.filter((id) => {
      const c = layout.cards.find((x) => x.id === id);
      return !c?.hidden && renderers[id];
    });
    return visible.sort((a, b) => {
      const pa = layout.cards.find((c) => c.id === a)?.pos ?? defaultPositionFor(a);
      const pb = layout.cards.find((c) => c.id === b)?.pos ?? defaultPositionFor(b);
      if (pa.y !== pb.y) return pa.y - pb.y;
      return pa.x - pb.x;
    });
  }, [layout, renderers]);
  return (
    <div className="flex flex-col gap-3">
      {ordered.map((id) => (
        <div key={id} className="dashboard-grid-item">
          {renderers[id]}
        </div>
      ))}
    </div>
  );
}

export function DashboardGrid({
  layout,
  renderers,
  onPositionsChange,
  readOnly,
}: DashboardGridProps) {
  /** All hooks must run on every render — keep them above any early return. */
  const isMobile = useIsMobile();
  const rglLayout = React.useMemo(() => toRglLayout(layout), [layout]);
  const { width, containerRef, mounted } = useContainerWidth();
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLayoutChange = React.useCallback(
    (next: RglLayoutItem[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const positions: Partial<Record<DashboardCardId, CardPosition>> = {};
        for (const item of next) {
          const id = item.i as DashboardCardId;
          if (!DASHBOARD_CARD_IDS.includes(id)) continue;
          const cur = layout.cards.find((c) => c.id === id);
          const curPos = cur?.pos ?? defaultPositionFor(id);
          if (
            curPos.x !== item.x ||
            curPos.y !== item.y ||
            curPos.w !== item.w ||
            curPos.h !== item.h
          ) {
            positions[id] = { x: item.x, y: item.y, w: item.w, h: item.h };
          }
        }
        if (Object.keys(positions).length > 0) onPositionsChange(positions);
      }, 350);
    },
    [layout, onPositionsChange]
  );

  React.useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const children = React.useMemo(
    () =>
      rglLayout.map((item) => {
        const id = item.i as DashboardCardId;
        const node = renderers[id];
        return (
          <div key={id} className="dashboard-grid-item">
            {node ?? null}
          </div>
        );
      }),
    [rglLayout, renderers]
  );

  if (isMobile) {
    return <MobileFlatStack layout={layout} renderers={renderers} />;
  }

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="dashboard-grid"
    >
      {mounted && width > 0 ? (
        <ResponsiveTyped
          width={width}
          layouts={{
            lg: rglLayout,
            md: rglLayout,
            sm: rglLayout,
            xs: rglLayout,
            xxs: rglLayout,
          }}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={80}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          draggableHandle=".dashboard-grid-handle"
          draggableCancel="[data-no-drag]"
          isDraggable={!readOnly}
          isResizable={!readOnly}
          compactType="vertical"
          onLayoutChange={handleLayoutChange}
        >
          {children}
        </ResponsiveTyped>
      ) : (
        <div className="text-muted-foreground py-8 text-center text-xs">Loading layout…</div>
      )}
    </div>
  );
}
