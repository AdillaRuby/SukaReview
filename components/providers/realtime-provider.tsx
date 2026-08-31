"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeToRealtimeChannels } from "@/lib/realtime/channels";

export type RealtimeStatus = "live" | "reconnecting" | "offline";

const RealtimeStatusContext = createContext<RealtimeStatus>("reconnecting");

export function useRealtimeStatus() {
  return useContext(RealtimeStatusContext);
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<RealtimeStatus>("reconnecting");
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const supabase = supabaseRef.current;

    function handleOffline() {
      setStatus("offline");
    }
    function handleOnline() {
      setStatus("reconnecting");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    const unsubscribe = subscribeToRealtimeChannels(supabase, (next) => {
      if (navigator.onLine === false) {
        setStatus("offline");
      } else {
        setStatus(next);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <RealtimeStatusContext.Provider value={status}>{children}</RealtimeStatusContext.Provider>
  );
}
