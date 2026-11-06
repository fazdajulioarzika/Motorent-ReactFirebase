import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Bike } from "lucide-react";
import SidebarGroup from "@/components/admin/SidebarGroup";
import SidebarUser from "@/components/admin/SidebarUser";
import {
  DASHBOARD,
  NAV_GROUPS,
  navLinkClass,
} from "@/components/admin/nav-config";

const STORAGE_KEY = "admin-nav-open";

function loadOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      boolean
    >;
  } catch {
    return {};
  }
}

interface Props {
  email: string;
  role: string;
  onNavigate: () => void;
}

export default function Sidebar({ email, role, onNavigate }: Props) {
  const { pathname } = useLocation();
  const isAdmin = role !== "staff";
  const [open, setOpen] = useState<Record<string, boolean>>(loadOpen);

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.adminOnly || isAdmin),
  })).filter((g) => g.items.length > 0);

  // Grup yang berisi halaman aktif otomatis terbuka.
  useEffect(() => {
    const active = groups.find((g) =>
      g.items.some((i) => pathname.startsWith(i.to))
    );
    if (active && !open[active.id])
      setOpen((o) => ({ ...o, [active.id]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggle(id: string) {
    setOpen((o) => {
      const next = { ...o, [id]: !o[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* penyimpanan tidak tersedia, abaikan */
      }
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col bg-neutral-900">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-neutral-800 px-5">
        <Bike className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold text-white">MotoRent</span>
        <span className="ml-auto rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
          Admin
        </span>
      </div>

      <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink
          to={DASHBOARD.to}
          className={navLinkClass}
          onClick={onNavigate}
        >
          <DASHBOARD.icon className="h-4 w-4 shrink-0" />
          {DASHBOARD.label}
        </NavLink>

        {groups.map((g) => (
          <SidebarGroup
            key={g.id}
            group={g}
            expanded={!!open[g.id]}
            hasActive={g.items.some((i) => pathname.startsWith(i.to))}
            onToggle={() => toggle(g.id)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <SidebarUser email={email} role={role} />
    </div>
  );
}
