import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { getGoogleMode } from "@/lib/google/auth";
import { GoogleConnectionCard } from "@/components/settings/google-connection-card";
import { NotificationSettingsCard } from "@/components/settings/notification-settings-card";
import { UsersManagement } from "@/components/settings/users-management";
import { SystemSettingsCard } from "@/components/settings/system-settings-card";

export default async function SettingsPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const isDemoMode = getGoogleMode() === "demo";
  const canManageSettings = canManage(profile.role);

  const { data: users } = await supabase.from("profiles").select("id, full_name, email, role").order("created_at");

  let connection = null;
  if (canManageSettings && !isDemoMode) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("google_connections")
      .select("account_name, status, locations_count, last_sync_at")
      .eq("status", "connected")
      .maybeSingle();
    if (data) {
      connection = {
        accountName: data.account_name,
        status: data.status,
        locationsCount: data.locations_count,
        lastSyncAt: data.last_sync_at,
      };
    }
  }

  const { data: alertSettings } = await supabase.from("alert_settings").select("*").single();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-lg font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Kelola integrasi, notifikasi, tim, dan aturan sistem.</p>
      </div>

      <GoogleConnectionCard isDemoMode={isDemoMode} connection={connection} canManageConnection={canManageSettings} />

      <NotificationSettingsCard />

      <UsersManagement
        users={(users ?? []).map((u) => ({ id: u.id, fullName: u.full_name, email: u.email, role: u.role }))}
        isOwner={profile.role === "owner"}
      />

      {canManageSettings && alertSettings && (
        <SystemSettingsCard
          initial={{
            low_outlet_rating_threshold: alertSettings.low_outlet_rating_threshold,
            urgent_review_rating_threshold: alertSettings.urgent_review_rating_threshold,
            negative_spike_count: alertSettings.negative_spike_count,
            negative_spike_window_hours: alertSettings.negative_spike_window_hours,
            rating_drop_threshold: alertSettings.rating_drop_threshold,
          }}
        />
      )}
    </div>
  );
}
