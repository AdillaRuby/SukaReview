"use client";

import { useState } from "react";
import { RefreshCw, Unplug, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { formatRelativeID } from "@/lib/format";

interface Connection {
  accountName: string;
  status: string;
  locationsCount: number;
  lastSyncAt: string | null;
}

export function GoogleConnectionCard({
  isDemoMode,
  connection,
  canManageConnection,
}: {
  isDemoMode: boolean;
  connection: Connection | null;
  canManageConnection: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/google/sync", { method: "POST" });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setDisconnecting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Google Business Profile</CardTitle>
          <CardDescription>Sumber data review untuk seluruh outlet.</CardDescription>
        </div>
        <Badge variant={isDemoMode ? "neutral" : connection ? "positive" : "outline"}>
          {isDemoMode ? "DEMO DATA" : connection ? "GOOGLE CONNECTED" : "NOT CONNECTED"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isDemoMode && (
          <p className="text-sm text-muted-foreground">
            Aplikasi berjalan dengan data demo. Set <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-xs">GOOGLE_MODE=live</code> dan
            hubungkan akun Google Business Profile untuk data review sungguhan.
          </p>
        )}

        {!isDemoMode && connection && (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Account</p>
              <p className="text-foreground">{connection.accountName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Locations</p>
              <p className="text-foreground">{connection.locationsCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Sync</p>
              <p className="text-foreground">{connection.lastSyncAt ? formatRelativeID(connection.lastSyncAt) : "-"}</p>
            </div>
          </div>
        )}

        {!isDemoMode && !canManageConnection && (
          <p className="text-xs text-muted-foreground">Hanya owner/admin yang dapat mengelola koneksi Google.</p>
        )}

        {!isDemoMode && canManageConnection && (
          <div className="flex flex-wrap gap-2">
            {!connection ? (
              <Button asChild>
                <a href="/api/google/oauth/authorize">
                  <ExternalLink className="size-4" /> Connect Google Account
                </a>
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={handleSync} disabled={syncing}>
                  {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Sync Now
                </Button>

                <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                    <Unplug className="size-4" /> Disconnect
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Putuskan koneksi Google?</DialogTitle>
                      <DialogDescription>
                        Sinkronisasi review baru akan berhenti sampai kamu menghubungkan ulang akun Google Business Profile.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="secondary">Batal</Button>
                      </DialogClose>
                      <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
                        {disconnecting && <Loader2 className="size-4 animate-spin" />} Disconnect
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
