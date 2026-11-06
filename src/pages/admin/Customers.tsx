import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminGet, adminPost } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { StatusBadge, fmtDate } from "@/pages/admin/Bookings";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/admin/Pagination";

interface CustomerRow {
  whatsapp: string;
  name: string;
  email: string;
  lastBookingAt: string;
  bookings: number;
  completed: number;
  cancelled: number;
  totalSpent: number;
  hasNote: boolean;
}

interface CustomerDetailData {
  whatsapp: string;
  name: string;
  email: string;
  address: string;
  totalSpent: number;
  note: string;
  noteUpdatedAt: string | null;
  bookings: {
    bookingCode: string;
    createdAt: string;
    motorTypeName: string;
    assignedPlate: string;
    pickupAt: string;
    returnAt: string;
    duration: number;
    total: number;
    paid: number;
    status: string;
  }[];
}

function Detail({ wa, onBack }: { wa: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-customer", wa],
    queryFn: () => adminGet<CustomerDetailData>(`/admin/customers/${wa}`),
  });
  useEffect(() => {
    if (data) setNote(data.note);
  }, [data]);
  const hist = usePagination(data?.bookings ?? [], 5);
  const save = useMutation({
    mutationFn: () => adminPost(`/admin/customers/${wa}/note`, { note }),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["admin-customer", wa] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading) return <p className="text-neutral-500">Memuat...</p>;
  if (error || !data)
    return (
      <p className="text-red-600">
        {(error as Error)?.message ?? "Tidak ditemukan"}
      </p>
    );

  return (
    <div className="max-w-3xl space-y-5">
      <button className="text-sm text-primary" onClick={onBack}>
        ← Kembali
      </button>
      <h1 className="text-2xl font-bold">{data.name}</h1>

      <section className="space-y-2 rounded-xl border bg-white p-5 text-sm">
        <Row k="WhatsApp" v={data.whatsapp} />
        <Row k="Email" v={data.email || "-"} />
        <Row k="Alamat" v={data.address || "-"} />
        <Row k="Total booking" v={String(data.bookings.length)} />
        <Row k="Total transaksi" v={formatRupiah(data.totalSpent)} />
        <a
          className="inline-block text-primary"
          target="_blank"
          rel="noreferrer"
          href={`https://wa.me/${data.whatsapp}`}
        >
          Chat via WhatsApp
        </a>
      </section>

      <section className="space-y-3 rounded-xl border bg-white p-5 text-sm">
        <h2 className="font-semibold">Catatan internal</h2>
        <Textarea
          rows={4}
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Contoh: sering telat mengembalikan, wajib bayar lunas di muka"
        />
        <p className="text-xs text-neutral-500">
          Hanya terlihat oleh admin. Jangan menulis data sensitif seperti nomor
          KTP.
        </p>
        {save.isError && (
          <p className="rounded bg-red-50 p-2 text-red-700">
            {(save.error as Error).message}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button
            disabled={save.isPending || note === data.note}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Menyimpan..." : "Simpan catatan"}
          </Button>
          {saved && <span className="text-green-700">Tersimpan</span>}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 text-sm">
        <h2 className="mb-3 font-semibold">Riwayat booking</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Kode</th>
                <th className="py-2 pr-3">Motor</th>
                <th className="py-2 pr-3">Ambil</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Dibayar</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {hist.items.map((b) => (
                <tr key={b.bookingCode} className="border-t">
                  <td className="py-2 pr-3 font-medium">
                    <Link
                      to={`/admin/bookings/${b.bookingCode}`}
                      className="text-primary"
                    >
                      {b.bookingCode}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    {b.motorTypeName}
                    {b.assignedPlate && (
                      <span className="block text-xs text-neutral-500">
                        {b.assignedPlate}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {b.pickupAt ? fmtDate(b.pickupAt) : "-"}
                  </td>
                  <td className="py-2 pr-3">{formatRupiah(b.total)}</td>
                  <td className="py-2 pr-3">{formatRupiah(b.paid)}</td>
                  <td className="py-2">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Pagination {...hist.props} sizes={[5, 10, 20]} />
    </div>
  );
}

export default function Customers() {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => adminGet<CustomerRow[]>("/admin/customers"),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.whatsapp.includes(q.replace(/\D/g, "") || "~")
    );
  }, [data, search]);
  const pg = usePagination(rows, 10, search);
  if (selected)
    return <Detail wa={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold">Pelanggan</h1>
      <Input
        placeholder="Cari nama atau nomor WhatsApp..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="md:max-w-xs"
      />

      {isLoading && <p className="text-neutral-500">Memuat...</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">WhatsApp</th>
              <th className="p-3">Booking</th>
              <th className="p-3">Selesai</th>
              <th className="p-3">Batal</th>
              <th className="p-3">Total transaksi</th>
              <th className="p-3">Terakhir</th>
            </tr>
          </thead>
          <tbody>
            {pg.items.map((c) => (
              <tr
                key={c.whatsapp}
                className="cursor-pointer border-t hover:bg-neutral-50"
                onClick={() => setSelected(c.whatsapp)}
              >
                <td className="p-3 font-medium text-primary">
                  {c.name}
                  {c.hasNote && (
                    <span className="ml-2 rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800">
                      Catatan
                    </span>
                  )}
                </td>
                <td className="p-3">{c.whatsapp}</td>
                <td className="p-3">{c.bookings}</td>
                <td className="p-3">{c.completed}</td>
                <td className="p-3">{c.cancelled}</td>
                <td className="p-3">{formatRupiah(c.totalSpent)}</td>
                <td className="p-3">{fmtDate(c.lastBookingAt)}</td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-neutral-500">
                  Belum ada pelanggan.
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-neutral-500">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
