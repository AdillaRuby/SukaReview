import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/types/database";

export interface CurrentProfile {
  id: string;
  email: string;
  fullName: string | null;
  role: ProfileRole;
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
  };
}

export function canManage(role: ProfileRole | undefined): boolean {
  return role === "owner" || role === "admin";
}
