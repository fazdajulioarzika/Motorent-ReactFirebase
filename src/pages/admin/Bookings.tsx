import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { adminGet } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/admin/Pagination";

export interface AdminBooking {
  bookingCode: string;
  customer: { name: string; whatsapp: string; email: string; address: string };
  motorTypeName: string;
  rentalPeriod: { pickupAt: string; returnAt: string; duration: number };
  pricing: {
    total: number;
    requiredPayment: number;
    paidAmount: number;
    remainingAmount: number;
  };
  paymentType: "dp" | "full";
  bookingStatus: string;
  paymentStatus: string;
  rejectReason?: string | null;
  createdAt: string;
  hasIdentity?: boolean;
}

export const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending_payment: {
    text: "Menunggu bayar",
    cls: "bg-yellow-100 text-yellow-800",
  },
  under_review: { text: "Perlu diperiksa", cls: "bg-blue-100 text-blue-800" },
  confirmed: { text: "Terkonfirmasi", cls: "bg-green-100 text-green-800" },
  ongoing: { text: "Berjalan", cls: "bg-purple-100 text-purple-800" },
  completed: { text: "Selesai", cls: "bg-neutral-200 text-neutral-700" },
  cancelled: { text: "Dibatalkan", cls: "bg-red-100 text-red-800" },
  expired: { text: "Kedaluwarsa", cls: "bg-neutral-200 text-neutral-600" },
};

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { text: status, cls: "bg-neutral-100" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.text}
    </span>
  );
}

export default function Bookings() {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => adminGet<AdminBooking[]>("/admin/bookings"),
    refetchInterval: 30000,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data
      .filter((b) => status === "all" || b.bookingStatus === status)
      .filter(
        (b) =>
          !q ||
          b.bookingCode.toLowerCase().includes(q) ||
          b.customer.name.toLowerCase().includes(q) ||
          b.customer.whatsapp.includes(q)
      );
  }, [data, search, status]);
  const pg = usePagination(rows, 10, `${search}|${status}`);
  return (
    <div>
      <h1 className="text-2xl font-bold">Booking</h1>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <Input
          placeholder="Cari kode, nama, atau WhatsApp..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:max-w-xs"
        />
        <select
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Semua status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v.text}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="mt-6 text-neutral-500">Memuat...</p>}
      {error && <p className="mt-6 text-red-600">{(error as Error).message}</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="p-3">Kode</th>
              <th className="p-3">Pelanggan</th>
              <th className="p-3">Motor</th>
              <th className="p-3">Ambil</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pg.items.map((b) => (
              <tr key={b.bookingCode} className="border-t hover:bg-neutral-50">
                <td className="p-3 font-medium">
                  <Link
                    to={`/admin/bookings/${b.bookingCode}`}
                    className="text-primary"
                  >
                    {b.bookingCode}
                  </Link>
                </td>
                <td className="p-3">{b.customer.name}</td>
                <td className="p-3">{b.motorTypeName}</td>
                <td className="p-3">{fmtDate(b.rentalPeriod.pickupAt)}</td>
                <td className="p-3">{formatRupiah(b.pricing.total)}</td>
                <td className="p-3">
                  <StatusBadge status={b.bookingStatus} />
                  {b.bookingStatus === "confirmed" &&
                    new Date(b.rentalPeriod.pickupAt) < new Date() && (
                      <span className="ml-2 text-xs text-red-600">
                        Lewat jadwal ambil
                      </span>
                    )}
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-neutral-500">
                  Belum ada booking.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...pg.props} />
    </div>
  );
}
