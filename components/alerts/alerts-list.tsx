"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCard } from "./alert-card";
import { EmptyState } from "@/components/common/empty-state";
import { realtimeBus } from "@/lib/realtime/bus";
import { CheckCircle2 } from "lucide-react";
import type { AlertWithOutlet } from "@/types/domain";

export function AlertsList({ alerts, canResolve }: { alerts: AlertWithOutlet[]; canResolve: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const offInsert = realtimeBus.on("alert-insert", () => router.refresh());
    const offUpdate = realtimeBus.on("alert-update", () => router.refresh());
    return () => {
      offInsert();
      offUpdate();
    };
  }, [router]);

  if (alerts.length === 0) {
    return <EmptyState icon={CheckCircle2} title="Tidak ada alert." description="Semua outlet dalam kondisi baik." />;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} canResolve={canResolve} onResolved={() => router.refresh()} />
      ))}
    </div>
  );
}
