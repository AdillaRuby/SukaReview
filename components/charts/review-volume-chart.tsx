"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateID } from "@/lib/format";
import type { RatingTrendPoint } from "@/types/domain";

export function ReviewVolumeChart({ data }: { data: RatingTrendPoint[] }) {
  if (data.length === 0) {
    return <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">Belum ada data.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => formatDateID(v).slice(0, 6)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelFormatter={(v) => formatDateID(String(v))}
          formatter={(value) => [Number(value), "Review"]}
        />
        <Bar dataKey="reviewCount" fill="var(--primary)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
