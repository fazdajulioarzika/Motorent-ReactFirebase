import {
  Bike,
  Boxes,
  ClipboardList,
  CornerDownLeft,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const DASHBOARD: NavItem = {
  to: "/admin/dashboard",
  label: "Dashboard",
  icon: LayoutDashboard,
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "operasional",
    label: "Operasional",
    items: [
      { to: "/admin/bookings", label: "Booking", icon: ClipboardList },
      { to: "/admin/payments", label: "Pembayaran", icon: CreditCard },
      { to: "/admin/rentals/pickup", label: "Pengambilan", icon: KeyRound },
      {
        to: "/admin/rentals/returns",
        label: "Pengembalian",
        icon: CornerDownLeft,
      },
    ],
  },
  {
    id: "katalog",
    label: "Katalog",
    items: [
      { to: "/admin/motor-types", label: "Tipe Motor", icon: Bike },
      { to: "/admin/motor-units", label: "Unit Motor", icon: Boxes },
      { to: "/admin/maintenance", label: "Perawatan", icon: Wrench },
    ],
  },
  {
    id: "bisnis",
    label: "Bisnis",
    items: [
      {
        to: "/admin/customers",
        label: "Pelanggan",
        icon: Users,
        adminOnly: true,
      },
      {
        to: "/admin/reports",
        label: "Laporan",
        icon: TrendingUp,
        adminOnly: true,
      },
    ],
  },
  {
    id: "sistem",
    label: "Sistem",
    items: [
      {
        to: "/admin/settings",
        label: "Pengaturan",
        icon: Settings,
        adminOnly: true,
      },
    ],
  },
];

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
};

export function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-primary text-white shadow-sm"
      : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
  }`;
}
