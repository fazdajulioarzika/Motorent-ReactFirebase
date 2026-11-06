import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminGet } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { StatusBadge, fmtDate } from "@/pages/admin/Bookings";

interface DashboardData {
  days: number;
  cards: {
    totalBookings: number;
    waitingPayment: number;
    needsReview: number;
    confirmed: number;
    ongoing: number;
    unitsAvailable: number;
    unitsRented: number;
    unitsMaintenance: number;
    revenue: number;
  };
  series: { date: string; revenue: number; bookings: number }[];
  statusCount: Record<string, number>;
  popularity: { name: string; count: number }[];
  recent: {
    bookingCode: string;
    customerName: string;
    motorTypeName: string;
    total: number;
    bookingStatus: string;
    createdAt: string;
  }[];
}

const ORANGE = "#F97316";
const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const compact = (n: number) =>
  n >= 1_000_000
    ? `${+(n / 1_000_000).toFixed(1)} jt`
    : n >= 1000
    ? `${Math.round(n / 1000)} rb`
    : String(n);

function Stat({
  label,
  value,
  hint,
  to,
}: {
  label: string;
  value: string;
  hint?: string;
  to?: string;
}) {
  const body = (
    <div className="h-full rounded-xl border bg-white p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
  return to ? (
    <Link to={to} className="block hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
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

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard", days],
    queryFn: () => adminGet<DashboardData>(`/admin/dashboard?days=${days}`),
    refetchInterval: 60000,
  });

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <select
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>7 hari terakhir</option>
          <option value={30}>30 hari terakhir</option>
          <option value={90}>90 hari terakhir</option>
        </select>
      </div>

      {isLoading && <p className="text-neutral-500">Memuat...</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Pendapatan"
              value={formatRupiah(data.cards.revenue)}
              hint={`${days} hari terakhir`}
            />
            <Stat
              label="Total booking"
              value={String(data.cards.totalBookings)}
              hint={`${days} hari terakhir`}
            />
            <Stat
              label="Perlu diperiksa"
              value={String(data.cards.needsReview)}
              hint="Bukti bayar menunggu"
              to="/admin/bookings"
            />
            <Stat
              label="Menunggu bayar"
              value={String(data.cards.waitingPayment)}
            />
            <Stat
              label="Terkonfirmasi"
              value={String(data.cards.confirmed)}
              hint="Siap diambil"
              to="/admin/rentals/pickup"
            />
            <Stat
              label="Sedang disewa"
              value={String(data.cards.ongoing)}
              to="/admin/rentals/returns"
            />
            <Stat
              label="Unit tersedia"
              value={String(data.cards.unitsAvailable)}
            />
            <Stat
              label="Unit disewa"
              value={String(data.cards.unitsRented)}
              hint={
                data.cards.unitsMaintenance
                  ? `${data.cards.unitsMaintenance} unit perawatan`
                  : undefined
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Pendapatan per hari">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.series}
                    margin={{ left: 0, right: 8, top: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      fontSize={11}
                      minTickGap={24}
                    />
                    <YAxis tickFormatter={compact} fontSize={11} width={48} />
                    <Tooltip
                      labelFormatter={(l) => shortDate(String(l))}
                      formatter={(v) => [formatRupiah(Number(v)), "Pendapatan"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke={ORANGE}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Booking per hari">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.series}
                    margin={{ left: 0, right: 8, top: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      fontSize={11}
                      minTickGap={24}
                    />
                    <YAxis allowDecimals={false} fontSize={11} width={32} />
                    <Tooltip
                      labelFormatter={(l) => shortDate(String(l))}
                      formatter={(v) => [Number(v), "Booking"]}
                    />
                    <Bar
                      dataKey="bookings"
                      fill={ORANGE}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Motor terpopuler">
              {data.popularity.length === 0 ? (
                <p className="text-sm text-neutral-500">Belum ada data.</p>
              ) : (
                <div style={{ height: data.popularity.length * 44 + 20 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.popularity}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        fontSize={11}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        fontSize={12}
                      />
                      <Tooltip formatter={(v) => [Number(v), "Booking"]} />
                      <Bar
                        dataKey="count"
                        fill={ORANGE}
                        radius={[0, 3, 3, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Distribusi status">
              {Object.keys(data.statusCount).length === 0 ? (
                <p className="text-sm text-neutral-500">Belum ada data.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {Object.entries(data.statusCount)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, n]) => (
                      <li
                        key={status}
                        className="flex items-center justify-between"
                      >
                        <StatusBadge status={status} />
                        <span className="font-medium">
                          {n}
                          <span className="ml-2 text-neutral-400">
                            {Math.round(
                              (n / Math.max(1, data.cards.totalBookings)) * 100
                            )}
                            %
                          </span>
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Booking terbaru">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-2 pr-3">Kode</th>
                    <th className="py-2 pr-3">Pelanggan</th>
                    <th className="py-2 pr-3">Motor</th>
                    <th className="py-2 pr-3">Dibuat</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((b) => (
                    <tr key={b.bookingCode} className="border-t">
                      <td className="py-2 pr-3 font-medium">
                        <Link
                          to={`/admin/bookings/${b.bookingCode}`}
                          className="text-primary"
                        >
                          {b.bookingCode}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{b.customerName}</td>
                      <td className="py-2 pr-3">{b.motorTypeName}</td>
                      <td className="py-2 pr-3">{fmtDate(b.createdAt)}</td>
                      <td className="py-2 pr-3">
                        {formatRupiah(Number(b.total ?? 0))}
                      </td>
                      <td className="py-2">
                        <StatusBadge status={b.bookingStatus} />
                      </td>
                    </tr>
                  ))}
                  {data.recent.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-neutral-500"
                      >
                        Belum ada booking.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
