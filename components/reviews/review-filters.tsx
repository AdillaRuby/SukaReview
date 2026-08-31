"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CATEGORY_LABELS, REVIEW_CATEGORIES } from "@/lib/taxonomy";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export function ReviewFilters({ outlets }: { outlets: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(search, 350);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  useEffect(() => {
    if (debouncedSearch !== (searchParams.get("search") ?? "")) {
      updateParam("search", debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <div className="relative flex-1 sm:min-w-[220px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search review..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>

      <Select
        defaultValue={searchParams.get("outletId") ?? ""}
        onChange={(e) => updateParam("outletId", e.target.value)}
        className="sm:w-44"
      >
        <option value="">All Outlets</option>
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>

      <Select defaultValue={searchParams.get("rating") ?? ""} onChange={(e) => updateParam("rating", e.target.value)} className="sm:w-32">
        <option value="">All Ratings</option>
        {[5, 4, 3, 2, 1].map((r) => (
          <option key={r} value={r}>
            {r} Bintang
          </option>
        ))}
      </Select>

      <Select defaultValue={searchParams.get("sentiment") ?? ""} onChange={(e) => updateParam("sentiment", e.target.value)} className="sm:w-36">
        <option value="">All Sentiments</option>
        <option value="positive">Positive</option>
        <option value="neutral">Neutral</option>
        <option value="negative">Negative</option>
      </Select>

      <Select defaultValue={searchParams.get("category") ?? ""} onChange={(e) => updateParam("category", e.target.value)} className="sm:w-40">
        <option value="">All Categories</option>
        {REVIEW_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </Select>

      <Select defaultValue={searchParams.get("sort") ?? "newest"} onChange={(e) => updateParam("sort", e.target.value)} className="sm:w-36">
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="lowest">Lowest Rating</option>
        <option value="highest">Highest Rating</option>
      </Select>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(e) => updateParam("from", e.target.value)}
          className="w-[140px]"
          aria-label="Dari tanggal"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <Input
          type="date"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(e) => updateParam("to", e.target.value)}
          className="w-[140px]"
          aria-label="Sampai tanggal"
        />
      </div>
    </div>
  );
}
