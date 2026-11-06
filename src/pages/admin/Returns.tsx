import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminGet, adminPost } from "@/lib/api";
import { useSettings } from "@/lib/useSettings";
import { formatRupiah } from "@/lib/format";
import { fmtDate, type AdminBooking } from "@/pages/admin/Bookings";

type RentalBooking = AdminBooking & {
  assignedUnitCode?: string;
  assignedPlate?: string;
  pickup?: { initialOdometer: number };
};

function ReturnForm({
  booking,
  onDone,
}: {
  booking: RentalBooking;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { policy } = useSettings();
  const lateMin = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(booking.rentalPeriod.returnAt).getTime()) / 60000
    )
  );
  const suggested =
    lateMin > policy.toleranceMinutes
      ? Math.ceil(lateMin / 60) * policy.lateFeePerHour
      : 0;

  const [odo, setOdo] = useState("");
  const [notes, setNotes] = useState("");
  const [lateFee, setLateFee] = useState(String(suggested));
  const [damageFee, setDamageFee] = useState("0");
  const [collected, setCollected] = useState(false);
  const [unitCondition, setUnitCondition] = useState<
    "good" | "needs_maintenance"
  >("good");

  const fees = (Number(lateFee) || 0) + (Number(damageFee) || 0);
  const initial = booking.pickup?.initialOdometer ?? 0;

  const save = useMutation({
    mutationFn: () =>
      adminPost("/admin/rentals/return", {
        bookingCode: booking.bookingCode,
        finalOdometer: Number(odo),
        conditionNotes: notes,
        lateFee: Number(lateFee) || 0,
        damageFee: Number(damageFee) || 0,
        feesCollected: fees <= 0 ? true : collected,
        unitCondition,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      onDone();
    },
  });

  const ready =
    odo !== "" && Number(odo) >= initial && (fees <= 0 || collected);

  return (
    <div className="space-y-4 rounded-xl border bg-white p-5 text-sm">
      <div>
        <p className="font-semibold">
          {booking.bookingCode} · {booking.customer.name}
        </p>
        <p className="text-neutral-500">
          {booking.motorTypeName} · {booking.assignedUnitCode} ·{" "}
          {booking.assignedPlate}
        </p>
        <p className="text-neutral-500">
          Jadwal kembali: {fmtDate(booking.rentalPeriod.returnAt)}
        </p>
        {lateMin > 0 && (
          <p
            className={
              lateMin > policy.toleranceMinutes
                ? "font-medium text-red-600"
                : "text-neutral-500"
            }
          >
            Terlambat {lateMin} menit
            {lateMin <= policy.toleranceMinutes && " (dalam toleransi)"}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Odometer akhir (km), awal {initial}</Label>
        <Input
          type="number"
          min={initial}
          value={odo}
          onChange={(e) => setOdo(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Denda keterlambatan (Rp)</Label>
          <Input
            type="number"
            min={0}
            value={lateFee}
            onChange={(e) => setLateFee(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Biaya kerusakan (Rp)</Label>
          <Input
            type="number"
            min={0}
            value={damageFee}
            onChange={(e) => setDamageFee(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Kondisi motor saat kembali</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <select
          className="h-9 w-full rounded-md border bg-white px-3"
          value={unitCondition}
          onChange={(e) =>
            setUnitCondition(e.target.value as "good" | "needs_maintenance")
          }
        >
          <option value="good">Baik, siap disewa lagi</option>
          <option value="needs_maintenance">
            Perlu perawatan (unit dikeluarkan dari stok)
          </option>
        </select>
      </div>

      {fees > 0 && (
        <label className="flex items-start gap-2 rounded-lg bg-orange-50 p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={collected}
            onChange={(e) => setCollected(e.target.checked)}
          />
          Denda/biaya {formatRupiah(fees)} sudah diterima dari penyewa.
        </label>
      )}

      {save.isError && (
        <p className="rounded bg-red-50 p-2 text-red-700">
          {(save.error as Error).message}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={!ready || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Menyimpan..." : "Selesaikan sewa"}
        </Button>
        <Button variant="outline" onClick={onDone}>
          Batal
        </Button>
      </div>
    </div>
  );
}

export default function Returns() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => adminGet<RentalBooking[]>("/admin/bookings"),
  });

  const q = search.trim().toLowerCase();
  const rows = data
    .filter((b) => b.bookingStatus === "ongoing")
    .filter(
      (b) =>
        !q ||
        b.bookingCode.toLowerCase().includes(q) ||
        b.customer.name.toLowerCase().includes(q) ||
        (b.assignedPlate ?? "").toLowerCase().includes(q)
    );
  const booking = rows.find((b) => b.bookingCode === selected);

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Pengembalian Motor</h1>
      <Input
        placeholder="Cari kode, nama, atau plat..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {booking ? (
        <ReturnForm booking={booking} onDone={() => setSelected(null)} />
      ) : (
        <div className="space-y-2">
          {isLoading && <p className="text-neutral-500">Memuat...</p>}
          {rows.map((b) => (
            <button
              key={b.bookingCode}
              onClick={() => setSelected(b.bookingCode)}
              className="flex w-full items-center justify-between rounded-xl border bg-white p-4 text-left text-sm hover:border-primary"
            >
              <span>
                <span className="font-semibold">{b.bookingCode}</span> ·{" "}
                {b.customer.name}
                <span className="block text-neutral-500">
                  {b.assignedPlate} · kembali {fmtDate(b.rentalPeriod.returnAt)}
                </span>
              </span>
              <span className="text-primary">Proses →</span>
            </button>
          ))}
          {!isLoading && rows.length === 0 && (
            <p className="text-neutral-500">
              Tidak ada motor yang sedang disewa.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
