"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { SentimentBreakdown } from "@/types/domain";

const COLORS: Record<string, string> = {
  Positive: "var(--positive)",
  Neutral: "var(--neutral-status)",
  Negative: "var(--negative)",
};

export function SentimentChart({ data }: { data: SentimentBreakdown }) {
  const chartData = [
    { name: "Positive", value: data.positive },
    { name: "Neutral", value: data.neutral },
    { name: "Negative", value: data.negative },
  ].filter((d) => d.value > 0);

  if (chartData.length === 0) {
    return <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">Belum ada data.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name]} stroke="var(--surface)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
        />
        <Legend
          verticalAlign="bottom"
          height={28}
          formatter={(value) => <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
