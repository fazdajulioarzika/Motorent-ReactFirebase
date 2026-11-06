import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminGet, adminPost } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { fmtDate, type AdminBooking } from "@/pages/admin/Bookings";

interface Unit {
  id: string;
  unitCode: string;
  plateNumber: string;
  condition: string;
  year?: number;
}

function PickupForm({
  booking,
  onDone,
}: {
  booking: AdminBooking;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [unitId, setUnitId] = useState("");
  const [odo, setOdo] = useState("");
  const [notes, setNotes] = useState("");
  const [idOk, setIdOk] = useState(false);
  const [paid, setPaid] = useState(false);
  const remaining = booking.pricing.remainingAmount;

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["units", booking.bookingCode],
    queryFn: () =>
      adminGet<Unit[]>(`/admin/bookings/${booking.bookingCode}/units`),
  });

  const save = useMutation({
    mutationFn: () =>
      adminPost("/admin/rentals/pickup", {
        bookingCode: booking.bookingCode,
        unitId,
        initialOdometer: Number(odo),
        conditionNotes: notes,
        idVerified: idOk,
        remainingCollected: remaining <= 0 ? true : paid,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      onDone();
    },
  });

  const ready = unitId && odo !== "" && idOk && (remaining <= 0 || paid);

  return (
    <div className="space-y-4 rounded-xl border bg-white p-5 text-sm">
      <div>
        <p className="font-semibold">
          {booking.bookingCode} · {booking.customer.name}
        </p>
        <p className="text-neutral-500">
          {booking.motorTypeName} · kembali{" "}
          {fmtDate(booking.rentalPeriod.returnAt)}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Unit motor (plat)</Label>
        <select
          className="h-9 w-full rounded-md border bg-white px-3"
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
        >
          <option value="">{isLoading ? "Memuat..." : "Pilih unit..."}</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unitCode} · {u.plateNumber} ({u.condition})
            </option>
          ))}
        </select>
        {!isLoading && units.length === 0 && (
          <p className="text-red-600">
            Tidak ada unit tersedia untuk tipe ini.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Odometer awal (km)</Label>
        <Input
          type="number"
          min={0}
          value={odo}
          onChange={(e) => setOdo(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Kondisi motor saat diserahkan</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contoh: lecet kecil di spakbor kiri"
        />
      </div>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={idOk}
          onChange={(e) => setIdOk(e.target.checked)}
        />
        Identitas penyewa (KTP/SIM) sudah dicek dan cocok dengan data booking.
      </label>

      {remaining > 0 ? (
        <label className="flex items-start gap-2 rounded-lg bg-orange-50 p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
          />
          Sisa pembayaran {formatRupiah(remaining)} sudah diterima dari penyewa.
        </label>
      ) : (
        <p className="rounded-lg bg-green-50 p-3 text-green-800">
          Pembayaran sudah lunas.
        </p>
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
          {save.isPending ? "Menyimpan..." : "Serahkan motor"}
        </Button>
        <Button variant="outline" onClick={onDone}>
          Batal
        </Button>
      </div>
    </div>
  );
}

export default function Pickup() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => adminGet<AdminBooking[]>("/admin/bookings"),
  });

  const q = search.trim().toLowerCase();
  const rows = data
    .filter((b) => b.bookingStatus === "confirmed")
    .filter(
      (b) =>
        !q ||
        b.bookingCode.toLowerCase().includes(q) ||
        b.customer.name.toLowerCase().includes(q)
    );
  const booking = rows.find((b) => b.bookingCode === selected);

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Pengambilan Motor</h1>
      <Input
        placeholder="Cari kode atau nama pelanggan..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {booking ? (
        <PickupForm booking={booking} onDone={() => setSelected(null)} />
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
                  {b.motorTypeName} · ambil {fmtDate(b.rentalPeriod.pickupAt)}
                </span>
              </span>
              <span className="text-primary">Proses →</span>
            </button>
          ))}
          {!isLoading && rows.length === 0 && (
            <p className="text-neutral-500">
              Tidak ada booking terkonfirmasi yang menunggu diambil.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
