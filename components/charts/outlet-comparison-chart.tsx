"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OutletRankingRow } from "@/lib/analytics/queries";

export function OutletComparisonChart({ outlets }: { outlets: OutletRankingRow[] }) {
  const data = [...outlets].sort((a, b) => b.currentRating - a.currentRating).slice(0, 10);

  if (data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Belum ada data.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          angle={-35}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis domain={[0, 5]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(value) => [Number(value).toFixed(1), "Rating"]}
        />
        <Bar dataKey="currentRating" fill="var(--accent)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
