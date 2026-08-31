import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { realtimeBus } from "./bus";

interface BroadcastChangePayload<T> {
  payload: {
    schema: string;
    table: string;
    commit_timestamp: string;
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: T;
    old: Partial<T>;
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
  const reviewsChannel = supabase
    .channel("reviews:feed", { config: { private: true } })
    .on("broadcast", { event: "INSERT" }, (msg: BroadcastChangePayload<Database["public"]["Tables"]["reviews"]["Row"]>) => {
      realtimeBus.emit("review-insert", msg.payload.new);
    })
    .on("broadcast", { event: "UPDATE" }, (msg: BroadcastChangePayload<Database["public"]["Tables"]["reviews"]["Row"]>) => {
      realtimeBus.emit("review-update", msg.payload.new);
    })
    .subscribe((status) => handleStatus(status));

  const alertsChannel = supabase
    .channel("alerts:feed", { config: { private: true } })
    .on("broadcast", { event: "INSERT" }, (msg: BroadcastChangePayload<Database["public"]["Tables"]["alerts"]["Row"]>) => {
      realtimeBus.emit("alert-insert", msg.payload.new);
    })
    .on("broadcast", { event: "UPDATE" }, (msg: BroadcastChangePayload<Database["public"]["Tables"]["alerts"]["Row"]>) => {
      realtimeBus.emit("alert-update", msg.payload.new);
    })
    .subscribe();

  const outletsChannel = supabase
    .channel("outlets:feed", { config: { private: true } })
    .on("broadcast", { event: "UPDATE" }, (msg: BroadcastChangePayload<Database["public"]["Tables"]["outlets"]["Row"]>) => {
      realtimeBus.emit("outlet-update", msg.payload.new);
    })
    .subscribe();

  const channelStatuses = new Map<string, string>();

  function handleStatus(status: string) {
    channelStatuses.set("reviews", status);
    if (status === "SUBSCRIBED") onStatusChange("live");
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatusChange("reconnecting");
    else if (status === "CLOSED") onStatusChange("offline");
  }

  return () => {
    supabase.removeChannel(reviewsChannel);
    supabase.removeChannel(alertsChannel);
    supabase.removeChannel(outletsChannel);
  };
}
