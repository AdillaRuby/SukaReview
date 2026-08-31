import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { getActiveAlertCount } from "@/lib/alerts/queries";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { AppProviders } from "@/components/providers/app-providers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const activeAlertCount = await getActiveAlertCount(supabase);

  return (
    <AppProviders>
      <div className="flex h-dvh overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader profile={profile} activeAlertCount={activeAlertCount} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AppProviders>
  );
}
