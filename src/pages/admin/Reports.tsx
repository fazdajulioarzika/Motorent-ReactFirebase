import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, startOfYear, subDays } from "date-fns";
import { Download, Printer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminGet } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatRupiah } from "@/lib/format";
import { STATUS_LABEL, StatusBadge } from "@/pages/admin/Bookings";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/admin/Pagination";

interface Row {
  period: string;
  dp: number;
  full: number;
  remaining: number;
  fee: number;
  refund: number;
  net: number;
  bookings: number;
}
interface ReportData {
  from: string;
  to: string;
  group: string;
  totals: {
    dp: number;
    full: number;
    remaining: number;
    fee: number;
    gross: number;
    refund: number;
    net: number;
  };
  rows: Row[];
  bookingCount: number;
  statusCount: Record<string, number>;
  motors: { name: string; count: number; days: number }[];
  pending: {
    pendingReview: number;
    outstanding: number;
    waitingPayment: number;
  };
  transactions: {
    date: string;
    bookingCode: string;
    type: string;
    method: string;
    amount: number;
  }[];
  bookings: {
    bookingCode: string;
    createdAt: string;
    customerName: string;
    whatsapp: string;
    motorTypeName: string;
    assignedPlate: string;
    pickupAt: string;
    returnAt: string;
    duration: number;
    paymentType: string;
    total: number;
    paid: number;
    remaining: number;
    status: string;
  }[];
}

const ORANGE = "#F97316";
const GROUP_LABEL: Record<string, string> = {
  day: "Harian",
  week: "Mingguan",
  month: "Bulanan",
  year: "Tahunan",
};
const TYPE_LABEL: Record<string, string> = {
  dp: "DP",
  full: "Lunas",
  remaining: "Pelunasan",
  fee: "Denda/biaya",
  refund: "Refund",
};
const compact = (n: number) =>
  n >= 1_000_000
    ? `${+(n / 1_000_000).toFixed(1)} jt`
    : n >= 1000
    ? `${Math.round(n / 1000)} rb`
    : String(n);
const stamp = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));

const today = () => format(new Date(), "yyyy-MM-dd");
const PRESETS: { label: string; range: () => [string, string] }[] = [
  {
    label: "7 hari",
    range: () => [format(subDays(new Date(), 6), "yyyy-MM-dd"), today()],
  },
  {
    label: "30 hari",
    range: () => [format(subDays(new Date(), 29), "yyyy-MM-dd"), today()],
  },
  {
    label: "Bulan ini",
    range: () => [format(startOfMonth(new Date()), "yyyy-MM-dd"), today()],
  },
  {
    label: "Tahun ini",
    range: () => [format(startOfYear(new Date()), "yyyy-MM-dd"), today()],
  },
];

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function Reports() {
  const [from, setFrom] = useState(PRESETS[1].range()[0]);
  const [to, setTo] = useState(PRESETS[1].range()[1]);
  const [group, setGroup] = useState("day");

  const valid = from !== "" && to !== "" && from <= to;
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["admin-report", from, to, group],
    queryFn: () =>
      adminGet<ReportData>(
        `/admin/reports?from=${from}&to=${to}&group=${group}`
      ),
    enabled: valid,
    retry: false,
  });
  const rowsPg = usePagination(data?.rows ?? [], 10, `${from}|${to}|${group}`);
  const motorsPg = usePagination(data?.motors ?? [], 5, `${from}|${to}`);
  function exportSummary(d: ReportData) {
    downloadCsv(`laporan-ringkasan_${d.from}_${d.to}.csv`, [
      [
        "Periode",
        "DP",
        "Lunas",
        "Pelunasan",
        "Denda/biaya",
        "Refund",
        "Pendapatan bersih",
        "Booking baru",
      ],
      ...d.rows.map((r) => [
        r.period,
        r.dp,
        r.full,
        r.remaining,
        r.fee,
        r.refund,
        r.net,
        r.bookings,
      ]),
      [
        "TOTAL",
        d.totals.dp,
        d.totals.full,
        d.totals.remaining,
        d.totals.fee,
        d.totals.refund,
        d.totals.net,
        d.bookingCount,
      ],
    ]);
  }
  function exportTransactions(d: ReportData) {
    downloadCsv(`laporan-transaksi_${d.from}_${d.to}.csv`, [
      ["Tanggal (WIB)", "Kode booking", "Jenis", "Metode", "Jumlah"],
      ...d.transactions.map((t) => [
        stamp(t.date),
        t.bookingCode,
        TYPE_LABEL[t.type] ?? t.type,
        t.method,
        t.type === "refund" ? -t.amount : t.amount,
      ]),
    ]);
  }
  function exportBookings(d: ReportData) {
    downloadCsv(`laporan-booking_${d.from}_${d.to}.csv`, [
      [
        "Kode",
        "Dibuat",
        "Pelanggan",
        "WhatsApp",
        "Motor",
        "Plat",
        "Ambil",
        "Kembali",
        "Durasi (hari)",
        "Pembayaran",
        "Total",
        "Dibayar",
        "Sisa",
        "Status",
      ],
      ...d.bookings.map((b) => [
        b.bookingCode,
        stamp(b.createdAt),
        b.customerName,
        b.whatsapp,
        b.motorTypeName,
        b.assignedPlate,
        b.pickupAt ? stamp(b.pickupAt) : "",
        b.returnAt ? stamp(b.returnAt) : "",
        b.duration,
        b.paymentType === "dp" ? "DP" : "Lunas",
        b.total,
        b.paid,
        b.remaining,
        STATUS_LABEL[b.status]?.text ?? b.status,
      ]),
    ]);
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Laporan</h1>
        <Button
          variant="outline"
          className="print:hidden"
          onClick={() => window.print()}
        >
          <Printer className="mr-2 h-4 w-4" /> Cetak / PDF
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border bg-white p-4 print:hidden">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="rounded-full border px-3 py-1 text-sm hover:border-primary hover:text-primary"
              onClick={() => {
                const [f, t] = p.range();
                setFrom(f);
                setTo(t);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <p className="mb-1 text-xs text-neutral-500">Dari</p>
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-neutral-500">Sampai</p>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-neutral-500">Kelompokkan</p>
            <select
              className="h-9 rounded-md border bg-white px-3"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              {Object.entries(GROUP_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!valid && (
          <p className="text-sm text-red-600">
            Tanggal awal harus sebelum tanggal akhir.
          </p>
        )}
      </div>

      {(isLoading || isFetching) && (
        <p className="text-neutral-500 print:hidden">Memuat...</p>
      )}
      {error && <p className="text-red-600">{(error as Error).message}</p>}

      {data && (
        <>
          <p className="hidden text-sm text-neutral-600 print:block">
            Periode {data.from} sampai {data.to} · {GROUP_LABEL[data.group]}
          </p>

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" onClick={() => exportSummary(data)}>
              <Download className="mr-2 h-4 w-4" /> CSV ringkasan
            </Button>
            <Button variant="outline" onClick={() => exportTransactions(data)}>
              <Download className="mr-2 h-4 w-4" /> CSV transaksi
            </Button>
            <Button variant="outline" onClick={() => exportBookings(data)}>
              <Download className="mr-2 h-4 w-4" /> CSV booking
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Pendapatan bersih"
              value={formatRupiah(data.totals.net)}
              hint="Setelah dikurangi refund"
            />
            <Stat
              label="Pendapatan kotor"
              value={formatRupiah(data.totals.gross)}
            />
            <Stat label="Refund" value={formatRupiah(data.totals.refund)} />
            <Stat label="Booking baru" value={String(data.bookingCount)} />
            <Stat label="DP diterima" value={formatRupiah(data.totals.dp)} />
            <Stat
              label="Lunas diterima"
              value={formatRupiah(data.totals.full)}
            />
            <Stat
              label="Pelunasan saat ambil"
              value={formatRupiah(data.totals.remaining)}
            />
            <Stat label="Denda/biaya" value={formatRupiah(data.totals.fee)} />
          </div>

          <Panel
            title={`Pendapatan bersih ${GROUP_LABEL[data.group].toLowerCase()}`}
          >
            {data.rows.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Tidak ada data pada rentang ini.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.rows}
                    margin={{ left: 0, right: 8, top: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="period" fontSize={11} minTickGap={24} />
                    <YAxis tickFormatter={compact} fontSize={11} width={48} />
                    <Tooltip
                      formatter={(v) => [formatRupiah(Number(v)), "Bersih"]}
                    />
                    <Bar
                      dataKey="net"
                      fill={ORANGE}
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="Rincian per periode">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-2 pr-3">Periode</th>
                    <th className="py-2 pr-3">DP</th>
                    <th className="py-2 pr-3">Lunas</th>
                    <th className="py-2 pr-3">Pelunasan</th>
                    <th className="py-2 pr-3">Denda</th>
                    <th className="py-2 pr-3">Refund</th>
                    <th className="py-2 pr-3">Bersih</th>
                    <th className="py-2">Booking</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsPg.items.map((r) => (
                    <tr key={r.period} className="border-t">
                      <td className="py-2 pr-3 font-medium">{r.period}</td>
                      <td className="py-2 pr-3">{formatRupiah(r.dp)}</td>
                      <td className="py-2 pr-3">{formatRupiah(r.full)}</td>
                      <td className="py-2 pr-3">{formatRupiah(r.remaining)}</td>
                      <td className="py-2 pr-3">{formatRupiah(r.fee)}</td>
                      <td className="py-2 pr-3">{formatRupiah(r.refund)}</td>
                      <td className="py-2 pr-3 font-semibold">
                        {formatRupiah(r.net)}
                      </td>
                      <td className="py-2">{r.bookings}</td>
                    </tr>
                  ))}
                  {data.rows.length > 0 && (
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2 pr-3">Total</td>
                      <td className="py-2 pr-3">
                        {formatRupiah(data.totals.dp)}
                      </td>
                      <td className="py-2 pr-3">
                        {formatRupiah(data.totals.full)}
                      </td>
                      <td className="py-2 pr-3">
                        {formatRupiah(data.totals.remaining)}
                      </td>
                      <td className="py-2 pr-3">
                        {formatRupiah(data.totals.fee)}
                      </td>
                      <td className="py-2 pr-3">
                        {formatRupiah(data.totals.refund)}
                      </td>
                      <td className="py-2 pr-3">
                        {formatRupiah(data.totals.net)}
                      </td>
                      <td className="py-2">{data.bookingCount}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination {...rowsPg.props} />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Motor paling banyak disewa">
              {data.motors.length === 0 ? (
                <p className="text-sm text-neutral-500">Belum ada data.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-neutral-500">
                    <tr>
                      <th className="py-2">Motor</th>
                      <th className="py-2">Booking</th>
                      <th className="py-2">Total hari</th>
                    </tr>
                  </thead>
                  <tbody>
                    {motorsPg.items.map((m) => (
                      <tr key={m.name} className="border-t">
                        <td className="py-2">{m.name}</td>
                        <td className="py-2">{m.count}</td>
                        <td className="py-2">{m.days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <Pagination {...motorsPg.props} sizes={[5, 10, 20]} />
            </Panel>

            <Panel title="Status booking">
              {Object.keys(data.statusCount).length === 0 ? (
                <p className="text-sm text-neutral-500">Belum ada data.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {Object.entries(data.statusCount)
                    .sort((a, b) => b[1] - a[1])
                    .map(([s, n]) => (
                      <li key={s} className="flex items-center justify-between">
                        <StatusBadge status={s} />
                        <span className="font-medium">{n}</span>
                      </li>
                    ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Pembayaran tertunda (posisi hari ini)">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-neutral-500">
                  Bukti bayar belum diperiksa
                </dt>
                <dd className="text-lg font-semibold">
                  {formatRupiah(data.pending.pendingReview)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Sisa tagihan booking aktif</dt>
                <dd className="text-lg font-semibold">
                  {formatRupiah(data.pending.outstanding)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">
                  Booking menunggu pembayaran
                </dt>
                <dd className="text-lg font-semibold">
                  {data.pending.waitingPayment}
                </dd>
              </div>
            </dl>
          </Panel>
        </>
      )}
    </div>
  );
}
