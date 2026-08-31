"use client";

import { useMemo, useState } from "react";
import { Search, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OutletCard } from "./outlet-card";
import { EmptyState } from "@/components/common/empty-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { OutletSummary } from "@/types/domain";

export function OutletsExplorer({ initialOutlets }: { initialOutlets: OutletSummary[] }) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 200);

  const filtered = useMemo(() => {
    if (!debounced) return initialOutlets;
    const q = debounced.toLowerCase();
    return initialOutlets.filter(
      (o) => o.name.toLowerCase().includes(q) || (o.city ?? "").toLowerCase().includes(q)
    );
  }, [initialOutlets, debounced]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Cari outlet..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Store} title="Outlet tidak ditemukan." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((outlet) => (
            <OutletCard key={outlet.id} outlet={outlet} />
          ))}
        </div>
      )}
    </div>
  );
}
