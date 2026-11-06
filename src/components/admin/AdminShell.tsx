import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Bike, Menu, X } from "lucide-react";
import Sidebar from "@/components/admin/Sidebar";

export default function AdminShell({
  email,
  role,
}: {
  email: string;
  role: string;
}) {
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();

  // Tutup drawer saat pindah halaman.
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Desktop: sidebar fixed */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 md:block print:hidden">
        <Sidebar email={email} role={role} onNavigate={() => {}} />
      </aside>

      {/* HP: bar atas */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-4 md:hidden print:hidden">
        <button
          type="button"
          aria-label="Buka menu"
          onClick={() => setDrawer(true)}
          className="rounded-md p-1.5 text-white hover:bg-neutral-800"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Bike className="h-5 w-5 text-primary" />
        <span className="font-bold text-white">MotoRent</span>
      </header>

      {/* HP: drawer */}
      <div
        className={`fixed inset-0 z-40 md:hidden print:hidden ${
          drawer ? "" : "pointer-events-none"
        }`}
        aria-hidden={!drawer}
      >
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
            drawer ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setDrawer(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-72 max-w-[85%] transition-transform duration-200 ${
            drawer ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setDrawer(false)}
            className="absolute right-2 top-3 z-10 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <Sidebar
            email={email}
            role={role}
            onNavigate={() => setDrawer(false)}
          />
        </aside>
      </div>

      <main className="min-h-screen pt-14 md:pl-64 md:pt-0 print:p-0">
        <div className="p-4 md:p-8 print:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
