"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RatingTrendChart } from "@/components/charts/rating-trend";
import { SentimentChart } from "@/components/charts/sentiment-chart";
import { CATEGORY_LABELS } from "@/lib/taxonomy";
import type { RatingTrendPoint, SentimentBreakdown, CategoryFrequency } from "@/types/domain";

export type Period = "7" | "30" | "90";

interface PeriodData {
  trend: RatingTrendPoint[];
  sentiment: SentimentBreakdown;
  complaints: CategoryFrequency[];
}

export function OutletPeriodView({ data }: { data: Record<Period, PeriodData> }) {
  const [period, setPeriod] = useState<Period>("30");
  const current = data[period];

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          <TabsTrigger value="7">7D</TabsTrigger>
          <TabsTrigger value="30">30D</TabsTrigger>
          <TabsTrigger value="90">90D</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rating Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingTrendChart data={current.trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sentiment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <SentimentChart data={current.sentiment} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Complaints</CardTitle>
        </CardHeader>
        <CardContent>
          {current.complaints.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada keluhan signifikan.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {current.complaints.map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-foreground">{CATEGORY_LABELS[c.category]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${c.percentage}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">{c.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
