import type { Database } from "@/types/database";

type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];
type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type OutletRow = Database["public"]["Tables"]["outlets"]["Row"];

interface RealtimeEventMap {
  "review-insert": ReviewRow;
  "review-update": ReviewRow;
  "alert-insert": AlertRow;
  "alert-update": AlertRow;
  "outlet-update": OutletRow;
}

/**
 * Tiny typed pub-sub so any component can react to realtime changes without
 * re-subscribing its own Postgres/Broadcast channel. RealtimeProvider is the
 * single writer; everything else only reads via `on()`.
 */
class RealtimeBus extends EventTarget {
  emit<K extends keyof RealtimeEventMap>(type: K, detail: RealtimeEventMap[K]) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on<K extends keyof RealtimeEventMap>(type: K, handler: (detail: RealtimeEventMap[K]) => void) {
    const listener = (e: Event) => handler((e as CustomEvent<RealtimeEventMap[K]>).detail);
    this.addEventListener(type, listener);
    return () => this.removeEventListener(type, listener);
  }
}

export const realtimeBus = new RealtimeBus();
