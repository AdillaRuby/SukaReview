"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/common/logo";
import { NAV_ITEMS } from "./nav-items";

const COLLAPSE_KEY = "sukareview:sidebar-collapsed";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Reads localStorage after mount (client/server render must match on
    // first paint) rather than in a lazy useState initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden h-full flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className={cn("flex h-16 items-center gap-2.5 border-b border-border px-4", collapsed && "justify-center px-0")}>
        <Logo size={collapsed ? 30 : 34} />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="font-display text-base font-bold tracking-tight text-foreground">SukaReview</p>
            <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              Suka Shawarma Review Monitor
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary-hover"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="size-4.5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={toggleCollapsed}
        className="flex items-center gap-2 border-t border-border px-3 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
        aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
      >
        {collapsed ? <ChevronsRight className="size-4" /> : (
          <>
            <ChevronsLeft className="size-4" /> Ciutkan
          </>
        )}
      </button>
    </aside>
  );
}
