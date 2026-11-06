import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Bike, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/useSettings";

const links = [
  { to: "/", label: "Beranda" },
  { to: "/motor", label: "Daftar Motor" },
  { to: "/track-booking", label: "Lacak Booking" },
  { to: "/contact", label: "Kontak" },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const { rental } = useSettings();
  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-bold text-neutral-900"
        >
          <Bike className="h-6 w-6 text-primary" /> {rental.name}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `text-sm font-medium ${
                  isActive
                    ? "text-primary"
                    : "text-neutral-600 hover:text-neutral-900"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <Button render={<Link to="/motor" />}>Pesan</Button>
        </nav>

        <button
          className="md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="space-y-1 border-t bg-white px-4 py-3 md:hidden">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium text-neutral-700"
            >
              {l.label}
            </Link>
          ))}
          <Button
            className="w-full"
            render={<Link to="/motor" onClick={() => setOpen(false)} />}
          >
            Pesan
          </Button>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const { rental } = useSettings();
  return (
    <footer className="mt-16 bg-neutral-900 text-neutral-300 print:hidden">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <Bike className="h-5 w-5 text-primary" /> {rental.name}
          </div>
          <p className="mt-2 text-sm">
            Sewa motor harian mudah, transparan, tanpa ribet.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Tautan</p>
          <ul className="mt-2 space-y-1">
            <li>
              <Link to="/motor">Daftar Motor</Link>
            </li>
            <li>
              <Link to="/track-booking">Lacak Booking</Link>
            </li>
            <li>
              <Link to="/terms">Syarat Sewa</Link>
            </li>
            <li>
              <Link to="/privacy-policy">Kebijakan Privasi</Link>
            </li>
            <li>
              <Link to="/contact">Kontak</Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Kontak</p>
          <p className="mt-2">{rental.address}</p>
          <p>WhatsApp: {rental.whatsapp}</p>
          <p>
            Jam operasional {String(rental.openHour).padStart(2, "0")}.00 sampai{" "}
            {String(rental.closeHour).padStart(2, "0")}.00 WIB
          </p>
        </div>
      </div>
      <div className="border-t border-neutral-800 py-4 text-center text-xs">
        © {new Date().getFullYear()} {rental.name}. All rights reserved.
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
