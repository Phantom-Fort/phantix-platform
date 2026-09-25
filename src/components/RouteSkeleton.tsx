import React from "react";
import { useLocation } from "react-router-dom";
import { PageSkeleton } from "@/components/ui";
import { useSidebarCollapsed } from "@/lib/useSidebarCollapsed";
import { cx } from "@/lib/utils";

type Variant = React.ComponentProps<typeof PageSkeleton>["variant"];

// The skeleton each page resolves into, so loading looks like the page arriving.
const ROUTE_SKELETONS: [prefix: string, variant: Variant, extra?: { rows?: number; cols?: number; actions?: boolean }][] = [
  ["/dashboard", "dashboard"],
  ["/identity", "settings"],
  ["/ai", "settings"],
  ["/agi", "settings"],
  ["/alerts", "settings"],
  ["/danger-zone", "settings", { rows: 2 }],
  ["/users", "table", { rows: 6, cols: 4, actions: true }],
  ["/audit", "table", { rows: 8, cols: 4 }],
  ["/agent-activity", "table", { rows: 8, cols: 4 }],
  ["/companies", "table", { rows: 5, cols: 3, actions: true }],
  ["/connections", "list", { rows: 3, actions: true }],
  ["/github", "list", { rows: 4 }],
  ["/integrations", "cards", { rows: 6 }],
  ["/applications", "cards", { rows: 4 }],
  ["/tools", "cards", { rows: 6 }],
  ["/billing", "cards", { rows: 3 }],
  ["/support", "split", { rows: 4, actions: true }],
  ["/sandbox", "list", { rows: 3 }],
  ["/docs", "list", { rows: 6 }],
  ["/setup", "wizard"],
];

/** The page-content skeleton for the current route. */
export function RouteSkeleton() {
  const { pathname } = useLocation();
  const hit = ROUTE_SKELETONS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const [, variant = "cards", extra = {}] = hit ?? [];
  return <PageSkeleton variant={variant} {...extra} className="!mx-0 !max-w-none" />;
}

/**
 * The management shell drawn as skeleton, with the route's page skeleton
 * inside. Used while the stored session is being restored, before the real
 * Layout can render, so a refresh never flashes a full-screen loader.
 */
export function ShellSkeleton() {
  const { collapsed } = useSidebarCollapsed();
  return (
    <div className="flex min-h-screen" aria-busy="true" aria-label="Loading">
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-phantix-700/40 bg-[rgb(var(--surface-sidebar))] lg:flex",
          collapsed ? "w-[72px]" : "w-[248px]",
        )}
      >
        <div className="flex items-center gap-3 px-4 pb-4 pt-4">
          <img src="/logo-white.png" alt="" className="h-8 w-8 shrink-0 object-contain" />
          {!collapsed && (
            <div className="space-y-1.5">
              <div className="skeleton h-3.5 w-24 rounded" />
              <div className="skeleton h-2.5 w-16 rounded" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-5 px-3">
          {[1, 4, 3, 3].map((items, g) => (
            <div key={g} className="space-y-2">
              {!collapsed && <div className="skeleton ml-1 h-2.5 w-20 rounded" />}
              {Array.from({ length: items }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-1 py-1">
                  <div className="skeleton h-5 w-5 shrink-0 rounded" />
                  {!collapsed && <div className="skeleton h-3.5 rounded" style={{ width: `${60 + ((g + i) % 3) * 15}%` }} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <div className={cx("flex min-h-screen min-w-0 flex-1 flex-col", collapsed ? "lg:ml-[72px]" : "lg:ml-[248px]")}>
        <header className="flex items-center gap-3 border-b border-phantix-700/40 px-4 py-3 sm:px-6">
          <div className="skeleton h-9 w-9 rounded-md lg:hidden" />
          <div className="skeleton h-4 w-40 rounded" />
          <div className="ml-auto flex items-center gap-2.5">
            <div className="skeleton h-9 w-9 rounded-md" />
            <div className="skeleton hidden h-7 w-36 rounded-md md:block" />
            <div className="skeleton h-10 w-10 rounded-md sm:w-44" />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <RouteSkeleton />
          </div>
        </main>
      </div>
    </div>
  );
}
