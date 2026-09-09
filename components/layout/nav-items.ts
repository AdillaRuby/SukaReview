import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, MessageSquare, Store, BarChart3, AlertTriangle, Settings } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: { href: string; label: string }[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/reviews",
    label: "Reviews",
    icon: MessageSquare,
    children: [
      { href: "/reviews", label: "Semua" },
      { href: "/reviews?rating=5", label: "5 Bintang" },
      { href: "/reviews?rating=4", label: "4 Bintang" },
      { href: "/reviews?rating=3", label: "3 Bintang" },
      { href: "/reviews?rating=2", label: "2 Bintang" },
      { href: "/reviews?rating=1", label: "1 Bintang" },
    ],
  },
  { href: "/outlets", label: "Outlets", icon: Store },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/settings", label: "Settings", icon: Settings },
];
