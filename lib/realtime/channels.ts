import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { realtimeBus } from "./bus";

interface BroadcastChangePayload<T> {
  payload: {
    schema: string;
    table: string;
    operation: "INSERT" | "UPDATE" | "DELETE";
    record: T;
    old_record: Partial<T>;
  };
}

/**
 * Subscribes to the three "Broadcast from Database" channels set up in
 * sql/010_realtime.sql, forwarding every change onto the local event bus.
 * Returns a cleanup function that removes all channels.
 */
export function subscribeToRealtimeChannels(
  supabase: SupabaseClient<Database>,
  onStatusChange: (status: "live" | "reconnecting" | "offline") => void
): () => void {
  // Tracked per-channel so a single channel erroring out (e.g. alerts or
  // outlets) can't be masked by the other two still reporting SUBSCRIBED —
  // "live" is only reported once every channel is actually connected.
  const channelStatuses = new Map<string, string>();

  function handleStatus(channel: string, status: string) {
    channelStatuses.set(channel, status);
    const statuses = Array.from(channelStatuses.values());
    if (statuses.every((s) => s === "SUBSCRIBED")) onStatusChange("live");
    else if (statuses.some((s) => s === "CLOSED")) onStatusChange("offline");
    else onStatusChange("reconnecting");
  }

  const reviewsChannel = supabase
    .channel("reviews:feed", { config: { private: true } })
    .on("broadcast", { event: "INSERT" }, (msg: BroadcastChangePayload<Database["public"]["Tables"]["reviews"]["Row"]>) => {
      realtimeBus.emit("review-insert", msg.payload.record);
    })
    .on("broadcast", { event: "UPDATE" }, (msg: BroadcastChangePayload<Database["public"]["Tables"]["reviews"]["Row"]>) => {
      realtimeBus.emit("review-update", msg.payload.record);
    })
    .subscribe((status) => handleStatus("reviews", status));

  const alertsChannel = supabase
    .channel("alerts:feed", { config: { private: true } })
    .on("broadcast", { event: "INSERT" }, (msg: BroadcastChangePayload<Database["public"]["Tables"]["alerts"]["Row"]>) => {
      realtimeBus.emit("alert-insert", msg.payload.record);
    })
    .on("broadcast", { event: "UPDATE" }, (msg: BroadcastChangePayload<Database["public"]["Tables"]["alerts"]["Row"]>) => {
      realtimeBus.emit("alert-update", msg.payload.record);
    })
    .subscribe((status) => handleStatus("alerts", status));

  const outletsChannel = supabase
    .channel("outlets:feed", { config: { private: true } })
    .on("broadcast", { event: "UPDATE" }, (msg: BroadcastChangePayload<Database["public"]["Tables"]["outlets"]["Row"]>) => {
      realtimeBus.emit("outlet-update", msg.payload.record);
    })
    .subscribe((status) => handleStatus("outlets", status));

  return () => {
    supabase.removeChannel(reviewsChannel);
    supabase.removeChannel(alertsChannel);
    supabase.removeChannel(outletsChannel);
  };
}
