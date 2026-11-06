import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { normalizeWhatsapp } from "@/lib/phone";

interface TrackResult {
  bookingCode: string;
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
  rejectReason: string | null;
  expiresAt: string;
  contactWhatsapp: string;
}

const STEPS = [
  "Booking dibuat",
  "Pembayaran diperiksa",
  "Terkonfirmasi",
  "Motor diambil",
  "Selesai",
];
const STEP_INDEX: Record<string, number> = {
  pending_payment: 0,
  under_review: 1,
  confirmed: 2,
  ongoing: 3,
  completed: 4,
};

const MESSAGE: Record<string, string> = {
  pending_payment:
    "Menunggu pembayaran. Buka link pembayaran dari email atau WhatsApp Anda untuk mentransfer dan mengunggah bukti.",
  under_review: "Bukti pembayaran Anda sedang diperiksa admin.",
  confirmed: "Booking terkonfirmasi. Bawa KTP/SIM asli saat mengambil motor.",
  ongoing:
    "Motor sedang Anda sewa. Kembalikan tepat waktu untuk menghindari denda.",
  completed: "Sewa selesai. Terima kasih telah menyewa.",
  expired:
    "Booking kedaluwarsa karena pembayaran tidak diterima tepat waktu. Silakan buat booking baru.",
  cancelled: "Booking ini dibatalkan.",
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));

export default function TrackBooking() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [wa, setWa] = useState("");

  const track = useMutation({
    mutationFn: () =>
      apiPost<TrackResult>("/track", {
        bookingCode: code.trim().toUpperCase(),
        whatsapp: normalizeWhatsapp(wa),
      }),
  });
  const r = track.data;

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold">Lacak Booking</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Masukkan kode booking dan nomor WhatsApp yang Anda pakai saat memesan.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          track.mutate();
        }}
        className="space-y-4 rounded-xl border bg-white p-5"
      >
        <div className="space-y-1.5">
          <Label>Kode booking</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="MR-20261105-001"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Nomor WhatsApp</Label>
          <Input
            value={wa}
            onChange={(e) => setWa(e.target.value)}
            placeholder="08123456789"
            inputMode="tel"
            required
          />
        </div>
        {track.isError && (
          <p className="rounded bg-red-50 p-2 text-sm text-red-700">
            {(track.error as Error).message}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={track.isPending}>
          {track.isPending ? "Mencari..." : "Lacak"}
        </Button>
      </form>

      {r && (
        <div className="space-y-5 rounded-xl border bg-white p-5 text-sm">
          <div>
            <p className="text-neutral-500">Kode booking</p>
            <p className="text-2xl font-bold">{r.bookingCode}</p>
          </div>

          {r.bookingStatus in STEP_INDEX ? (
            <ol className="space-y-2">
              {STEPS.map((label, i) => {
                const now = STEP_INDEX[r.bookingStatus];
                const done = i < now || r.bookingStatus === "completed";
                const current = i === now && r.bookingStatus !== "completed";
                return (
                  <li key={label} className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        done
                          ? "bg-green-600 text-white"
                          : current
                          ? "bg-primary text-white"
                          : "bg-neutral-200 text-neutral-500"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span
                      className={
                        current
                          ? "font-semibold"
                          : done
                          ? ""
                          : "text-neutral-400"
                      }
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <p
            className={`rounded-lg p-3 ${
              ["expired", "cancelled"].includes(r.bookingStatus)
                ? "bg-red-50 text-red-700"
                : "bg-orange-50 text-orange-800"
            }`}
          >
            {MESSAGE[r.bookingStatus] ?? r.bookingStatus}
          </p>
          {r.rejectReason && r.bookingStatus === "pending_payment" && (
            <p className="rounded-lg bg-red-50 p-3 text-red-700">
              Pembayaran sebelumnya ditolak: {r.rejectReason}
            </p>
          )}

          <dl className="space-y-2 border-t pt-4">
            <Row k="Motor" v={r.motorTypeName} />
            <Row k="Ambil" v={`${fmt(r.rentalPeriod.pickupAt)} WIB`} />
            <Row k="Kembali" v={`${fmt(r.rentalPeriod.returnAt)} WIB`} />
            <Row k="Durasi" v={`${r.rentalPeriod.duration} hari`} />
            <Row k="Total tagihan" v={formatRupiah(r.pricing.total)} />
            <Row k="Sudah dibayar" v={formatRupiah(r.pricing.paidAmount)} />
            <Row
              k="Sisa pembayaran"
              v={formatRupiah(r.pricing.remainingAmount)}
              bold
            />
          </dl>

          {r.contactWhatsapp && (
            <a
              className="inline-block text-primary"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/${
                r.contactWhatsapp
              }?text=${encodeURIComponent(
                `Halo, saya ingin bertanya tentang booking ${r.bookingCode}`
              )}`}
            >
              Hubungi rental via WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 ${bold ? "font-semibold" : ""}`}
    >
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
