"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

/** Tiny inline trend line — no axes/grid/tooltip, just the shape of the trend. */
export function MiniSparkline({ data, color = "var(--accent)" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;

  const points = data.map((value, i) => ({ i, value }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <YAxis domain={["dataMin - 0.3", "dataMax + 0.3"]} hide />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
