"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, User as UserIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AppSidebar } from "./app-sidebar";
import { NAV_ITEMS } from "./nav-items";
import { Logo } from "@/components/common/logo";
import { ConnectionBadge } from "@/components/common/connection-badge";
import { SoundToggle } from "./sound-toggle";
import { NotificationBell } from "./notification-bell";
import { createClient } from "@/lib/supabase/client";
import type { CurrentProfile } from "@/lib/auth/get-current-profile";

export function TopHeader({
  profile,
  activeAlertCount,
}: {
  profile: CurrentProfile;
  activeAlertCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((item) => pathname.startsWith(item.href));
  const displayName = profile.fullName || profile.email;
  const initials = displayName.slice(0, 2).toUpperCase();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground md:hidden" aria-label="Buka menu">
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent>
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 md:hidden">
          <Logo size={26} />
          <p className="font-display text-sm font-bold text-foreground">SukaReview</p>
        </div>

        <h1 className="hidden font-display text-sm font-semibold text-foreground md:block">
          {currentNav?.label ?? "SukaReview"}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <ConnectionBadge />
        <div className="hidden sm:block">
          <SoundToggle />
        </div>
        <NotificationBell initialActiveCount={activeAlertCount} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/50" aria-label="Menu pengguna">
              <Avatar>
                <AvatarFallback>{initials || <UserIcon className="size-4" />}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <p className="text-foreground">{displayName}</p>
              <p className="font-normal capitalize text-muted-foreground">{profile.role}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
