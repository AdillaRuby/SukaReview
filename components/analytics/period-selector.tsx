"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PeriodSelector({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Tabs value={current} onValueChange={handleChange}>
      <TabsList>
        <TabsTrigger value="7">7D</TabsTrigger>
        <TabsTrigger value="30">30D</TabsTrigger>
        <TabsTrigger value="90">90D</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
