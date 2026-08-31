"use client";

import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RealtimeProvider } from "./realtime-provider";
import { NotificationPreferencesProvider } from "./notification-preferences-provider";
import { SoundController } from "@/components/notifications/sound-controller";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <NotificationPreferencesProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <SoundController />
          <Toaster
            position="top-right"
            theme="light"
            toastOptions={{
              style: {
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              },
            }}
          />
        </TooltipProvider>
      </NotificationPreferencesProvider>
    </RealtimeProvider>
  );
}
