"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { realtimeBus } from "@/lib/realtime/bus";

export function NotificationBell({ initialActiveCount }: { initialActiveCount: number }) {
  const [count, setCount] = useState(initialActiveCount);

  useEffect(() => {
    // Resyncs with the server-computed count on every re-render with a new
    // prop (e.g. after router.refresh()) — useState's initial value only
    // applies at mount, so without this the badge goes stale once a bus
    // event is missed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCount(initialActiveCount);
  }, [initialActiveCount]);

  useEffect(() => {
    const offInsert = realtimeBus.on("alert-insert", () => setCount((c) => c + 1));
    const offUpdate = realtimeBus.on("alert-update", (alert) => {
      if (alert.status === "resolved") setCount((c) => Math.max(0, c - 1));
    });
    return () => {
      offInsert();
      offUpdate();
    };
  }, []);

  return (
    <Link
      href="/alerts"
      className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
      aria-label={`Notifikasi, ${count} alert aktif`}
    >
      <Bell className="size-4.5" />
      {count > 0 && (
        <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
