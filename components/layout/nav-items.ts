import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, MessageSquare, Store, BarChart3, AlertTriangle, Settings } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reviews", label: "Reviews", icon: MessageSquare },
  { href: "/outlets", label: "Outlets", icon: Store },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/settings", label: "Settings", icon: Settings },
];
