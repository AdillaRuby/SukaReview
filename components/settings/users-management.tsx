"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRole } from "@/types/database";

interface UserRow {
  id: string;
  fullName: string | null;
  email: string;
  role: ProfileRole;
}

export function UsersManagement({ users, isOwner }: { users: UserRow[]; isOwner: boolean }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleRoleChange(userId: string, role: ProfileRole) {
    setPendingId(userId);
    const supabase = createClient();
    await supabase.from("profiles").update({ role }).eq("id", userId);
    setPendingId(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>{users.length} anggota tim memiliki akses ke SukaReview.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-7">
                <AvatarFallback className="text-[10px]">
                  {(user.fullName || user.email).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{user.fullName || "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            {isOwner ? (
              <Select
                value={user.role}
                onChange={(e) => handleRoleChange(user.id, e.target.value as ProfileRole)}
                disabled={pendingId === user.id}
                className="w-28 shrink-0"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </Select>
            ) : (
              <span className="shrink-0 text-xs capitalize text-muted-foreground">{user.role}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
