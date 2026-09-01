"use client";

import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeID } from "@/lib/format";
import type { PlacesSyncStatus } from "@/types/database";

interface PlacesSyncStateSummary {
  lastSyncedAt: string | null;
  lastStatus: PlacesSyncStatus;
  lastError: string | null;
  newReviewsFound: number;
}

export function PlacesSyncCard({
  configured,
  state,
  linkedOutlets,
  canManage,
}: {
  configured: boolean;
  state: PlacesSyncStateSummary | null;
  linkedOutlets: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/places/sync", { method: "POST" });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  const failed = state?.lastStatus === "failed";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Google Places Review Sync</CardTitle>
          <CardDescription>Sumber data alternatif tanpa perlu akses Manager Google Business Profile.</CardDescription>
        </div>
        <Badge variant={!configured ? "outline" : failed ? "negative" : "positive"}>
          {!configured ? "BELUM DIKONFIGURASI" : failed ? "SYNC GAGAL" : "AKTIF"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!configured && (
          <p className="text-sm text-muted-foreground">
            Set <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-xs">GOOGLE_PLACES_API_KEY</code> di
            environment variables untuk mengaktifkan sumber data ini.
          </p>
        )}

        {configured && (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Outlet Terhubung</p>
              <p className="text-foreground">{linkedOutlets}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sync Terakhir</p>
              <p className="text-foreground">{state?.lastSyncedAt ? formatRelativeID(state.lastSyncedAt) : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Review Baru (Sync Terakhir)</p>
              <p className="text-foreground">{state?.newReviewsFound ?? 0}</p>
            </div>
          </div>
        )}

        {configured && failed && state?.lastError && <p className="text-xs text-negative">{state.lastError}</p>}

        {!canManage && <p className="text-xs text-muted-foreground">Hanya owner/admin yang dapat menjalankan sync.</p>}

        {configured && canManage && (
          <div>
            <Button variant="secondary" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Sync Now
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
