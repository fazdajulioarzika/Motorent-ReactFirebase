import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminGet } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatRupiah } from "@/lib/format";
import { fmtDate } from "@/pages/admin/Bookings";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/admin/Pagination";

interface PaymentRow {
  id: string;
  bookingCode: string;
  customerName: string;
  motorTypeName: string;
  paymentType: string;
  amount: number;
  method: string;
  status: string;
  rejectReason: string | null;
  hasProof: boolean;
  createdAt: string | null;
  verifiedAt: string | null;
}

const STATUS: Record<string, { text: string; cls: string }> = {
  under_review: { text: "Perlu diperiksa", cls: "bg-blue-100 text-blue-800" },
  approved: { text: "Disetujui", cls: "bg-green-100 text-green-800" },
  rejected: { text: "Ditolak", cls: "bg-red-100 text-red-800" },
  cancelled: { text: "Dibatalkan", cls: "bg-neutral-200 text-neutral-600" },
};
const TYPE: Record<string, string> = {
  dp: "DP",
  full: "Lunas",
  remaining: "Pelunasan",
  fee: "Denda/biaya",
  refund: "Refund",
};

export default function Payments() {
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");

  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => adminGet<PaymentRow[]>("/admin/payments"),
    refetchInterval: 30000,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data
      .filter((p) => status === "all" || p.status === status)
      .filter((p) => type === "all" || p.paymentType === type)
      .filter(
        (p) =>
          !q ||
          p.bookingCode.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q)
      );
  }, [data, status, type, search]);
  const pg = usePagination(rows, 10, `${status}|${type}|${search}`);
  const totals = useMemo(() => {
    let received = 0;
    let refund = 0;
    for (const p of rows) {
      if (p.status !== "approved") continue;
      if (p.paymentType === "refund") refund += p.amount;
      else received += p.amount;
    }
    const waiting = rows.filter((p) => p.status === "under_review").length;
    return { received, refund, net: received - refund, waiting };
  }, [rows]);

  function exportCsv() {
    downloadCsv(`pembayaran_${new Date().toISOString().slice(0, 10)}.csv`, [
      [
        "Dibuat",
        "Kode booking",
        "Pelanggan",
        "Motor",
        "Jenis",
        "Metode",
        "Jumlah",
        "Status",
        "Alasan ditolak",
      ],
      ...rows.map((p) => [
        p.createdAt ? fmtDate(p.createdAt) : "",
        p.bookingCode,
        p.customerName,
        p.motorTypeName,
        TYPE[p.paymentType] ?? p.paymentType,
        p.method,
        p.paymentType === "refund" ? -p.amount : p.amount,
        STATUS[p.status]?.text ?? p.status,
        p.rejectReason ?? "",
      ]),
    ]);
  }

  const sel = "h-9 rounded-md border bg-white px-3 text-sm";

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Pembayaran</h1>
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={rows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Perlu diperiksa" value={String(totals.waiting)} />
        <Stat
          label="Diterima (disetujui)"
          value={formatRupiah(totals.received)}
        />
        <Stat label="Refund" value={formatRupiah(totals.refund)} />
        <Stat label="Bersih" value={formatRupiah(totals.net)} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <Input
          placeholder="Cari kode booking atau nama..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:max-w-xs"
        />
        <select
          className={sel}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Semua status</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.text}
            </option>
          ))}
        </select>
        <select
          className={sel}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">Semua jenis</option>
          {Object.entries(TYPE).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-neutral-500">Memuat...</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="p-3">Dibuat</th>
              <th className="p-3">Booking</th>
              <th className="p-3">Pelanggan</th>
              <th className="p-3">Jenis</th>
              <th className="p-3">Jumlah</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {pg.items.map((p) => (
              <tr key={p.id} className="border-t hover:bg-neutral-50">
                <td className="p-3">
                  {p.createdAt ? fmtDate(p.createdAt) : "-"}
                </td>
                <td className="p-3 font-medium">
                  <Link
                    to={`/admin/bookings/${p.bookingCode}`}
                    className="text-primary"
                  >
                    {p.bookingCode}
                  </Link>
                  <span className="block text-xs font-normal text-neutral-500">
                    {p.motorTypeName}
                  </span>
                </td>
                <td className="p-3">{p.customerName}</td>
                <td className="p-3">{TYPE[p.paymentType] ?? p.paymentType}</td>
                <td
                  className={`p-3 font-medium ${
                    p.paymentType === "refund" ? "text-red-600" : ""
                  }`}
                >
                  {p.paymentType === "refund" ? "-" : ""}
                  {formatRupiah(p.amount)}
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      STATUS[p.status]?.cls ?? "bg-neutral-100"
                    }`}
                  >
                    {STATUS[p.status]?.text ?? p.status}
                  </span>
                  {p.rejectReason && (
                    <span className="block text-xs text-red-600">
                      {p.rejectReason}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {p.status === "under_review" && (
                    <Link
                      to={`/admin/bookings/${p.bookingCode}`}
                      className="text-primary"
                    >
                      Periksa →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-neutral-500">
                  Tidak ada pembayaran.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
