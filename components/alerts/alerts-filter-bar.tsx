"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AlertsFilterBar({ outlets }: { outlets: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const status = searchParams.get("status") ?? "";
  const severity = searchParams.get("severity") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={status || "all"} onValueChange={(v) => updateParam("status", v === "all" ? "" : v)}>
        <TabsList>
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
      </Tabs>

      <Select
        value={severity}
        onChange={(e) => updateParam("severity", e.target.value)}
        className="w-36"
      >
        <option value="">Semua Severity</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </Select>

      <Select
        value={searchParams.get("outletId") ?? ""}
        onChange={(e) => updateParam("outletId", e.target.value)}
        className="w-44"
      >
        <option value="">Semua Outlet</option>
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
