import { useMemo, useState } from "react";
import { addDays, addMinutes, format, isSameDay, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";

function buildSlots(open: number, close: number): string[] {
  const out: string[] = [];

  for (let h = open; h <= close; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);

    if (h < close) {
      out.push(`${String(h).padStart(2, "0")}:30`);
    }
  }

  return out;
}

const QUICK = [
  { label: "1 hari", days: 1 },
  { label: "2 hari", days: 2 },
  { label: "3 hari", days: 3 },
  { label: "1 minggu", days: 7 },
];

function combine(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

const toValue = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

const fmtDate = (d: Date) =>
  format(d, "EEEE, d MMM yyyy", { locale: idLocale });

interface Props {
  pickupAt: string;
  returnAt: string;
  openHour: number;
  closeHour: number;
  onChange: (pickupAt: string, returnAt: string) => void;
}

export default function DateTimeRangePicker({
  pickupAt,
  returnAt,
  openHour,
  closeHour,
  onChange,
}: Props) {
  const SLOTS = useMemo(
    () => buildSlots(openHour, closeHour),
    [openHour, closeHour]
  );

  const defaultTime = SLOTS.includes("08:00") ? "08:00" : SLOTS[0];

  const [pickupTime, setPickupTime] = useState(
    pickupAt ? pickupAt.slice(11, 16) : defaultTime
  );

  const [returnTime, setReturnTime] = useState(
    returnAt ? returnAt.slice(11, 16) : defaultTime
  );

  const pickupDate = pickupAt ? new Date(pickupAt) : undefined;
  const returnDate = returnAt ? new Date(returnAt) : undefined;

  // Jika pengambilan hari ini, jam yang sudah lewat (+1 jam persiapan) disembunyikan.
  const earliest = addMinutes(new Date(), 60);

  const pickupSlots =
    pickupDate && isSameDay(pickupDate, new Date())
      ? SLOTS.filter((t) => combine(pickupDate, t) >= earliest)
      : SLOTS;

  function emit(
    pDate: Date | undefined,
    pTime: string,
    rDate: Date | undefined,
    rTime: string
  ) {
    onChange(
      pDate ? toValue(combine(pDate, pTime)) : "",
      rDate ? toValue(combine(rDate, rTime)) : ""
    );
  }

  function onSelectRange(range: DateRange | undefined) {
    const from = range?.from;

    const to =
      range?.to && from && !isSameDay(range.to, from) ? range.to : undefined;

    // Pilih ulang dari awal jika rentang sudah lengkap lalu klik tanggal lain.
    emit(from, pickupTime, to, returnTime);
  }

  function onPickupTime(t: string) {
    setPickupTime(t);
    setReturnTime(t);

    // Default: kembali di jam yang sama.
    emit(pickupDate, t, returnDate, t);
  }

  function onReturnTime(t: string) {
    setReturnTime(t);
    emit(pickupDate, pickupTime, returnDate, t);
  }

  function quick(days: number) {
    if (!pickupDate) return;

    setReturnTime(pickupTime);
    emit(pickupDate, pickupTime, addDays(pickupDate, days), pickupTime);
  }

  const selectClass = "h-10 w-full rounded-md border bg-white px-3 text-sm";

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <div className="flex justify-center">
        <Calendar
          mode="range"
          locale={idLocale}
          selected={
            pickupDate ? { from: pickupDate, to: returnDate } : undefined
          }
          onSelect={onSelectRange}
          disabled={{ before: startOfDay(new Date()) }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-neutral-500">Jam Ambil</p>

          <select
            className={selectClass}
            value={pickupTime}
            onChange={(e) => onPickupTime(e.target.value)}
          >
            {pickupSlots.map((t) => (
              <option key={t} value={t}>
                {t} WIB
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-neutral-500">
            Jam Kembali
          </p>

          <select
            className={selectClass}
            value={returnTime}
            onChange={(e) => onReturnTime(e.target.value)}
          >
            {SLOTS.map((t) => (
              <option key={t} value={t}>
                {t} WIB
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-neutral-500">
          Durasi cepat {pickupDate ? "" : "(pilih tanggal ambil dulu)"}
        </p>

        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q.days}
              type="button"
              disabled={!pickupDate}
              onClick={() => quick(q.days)}
              className="rounded-full border px-3 py-1 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-neutral-50 p-3 text-sm">
        <div className="flex gap-1">
          <span className="text-primary w-1/3">Mulai</span>
          <span>
            {pickupDate
              ? `${fmtDate(pickupDate)}, ${pickupTime}`
              : "Klik tanggal di kalender"}
          </span>
        </div>

        <div className="flex gap-1">
          <span className="text-primary w-1/3">Selesai</span>
          <span>
            {returnDate
              ? `${fmtDate(returnDate)}, ${returnTime}`
              : "Klik tanggal di kalender"}
          </span>
        </div>
      </div>
    </div>
  );
}
