import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import { apiGet, apiUpload } from "@/lib/api";
import IdentityUpload from "@/components/booking/IdentityUpload";

interface BookingView {
  bookingCode: string;
  motorTypeName: string;
  customerName: string;
  rentalPeriod: { pickupAt: string; returnAt: string; duration: number };
  pricing: {
    rentalCost: number;
    deposit: number;
    total: number;
    requiredPayment: number;
  };
  paymentType: "dp" | "full";
  bookingStatus: string;
  paymentStatus: string;
  expiresAt: string;
  hasIdentity: boolean;
  paymentInfo: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    note?: string;
  };
  rejectReason?: string | null;
}

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

function useCountdown(target?: string) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!target) return;
    const tick = () =>
      setLeft(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);
  const s = Math.floor(left / 1000);
  const text = `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(
    Math.floor((s % 3600) / 60)
  ).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return { expired: !!target && left === 0, text };
}

export default function Payment() {
  const { bookingCode = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["booking", bookingCode, token],
    queryFn: () =>
      apiGet<BookingView>(
        `/bookings/${bookingCode}?token=${encodeURIComponent(token)}`
      ),
    enabled: !!token,
    retry: false,
  });

  const countdown = useCountdown(data?.expiresAt);

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("token", token);
      form.append("file", file as File);
      return apiUpload(`/bookings/${bookingCode}/proof`, form);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["booking", bookingCode, token] }),
  });

  function onPick(f: File | null) {
    setFileError("");
    if (!f) return setFile(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setFile(null);
      return setFileError("File harus JPG, PNG, atau WEBP");
    }
    if (f.size > 5 * 1024 * 1024) {
      setFile(null);
      return setFileError("Ukuran file maksimal 5 MB");
    }
    setFile(f);
  }

  async function copyAccount() {
    if (!data) return;
    await navigator.clipboard.writeText(data.paymentInfo.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!token) {
    return (
      <p className="p-10 text-center text-neutral-600">
        Link pembayaran tidak lengkap. Gunakan link dari email atau WhatsApp
        Anda.
      </p>
    );
  }
  if (isLoading)
    return <p className="p-10 text-center text-neutral-500">Memuat...</p>;
  if (error || !data) {
    return (
      <p className="p-10 text-center text-red-600">
        {(error as Error)?.message ?? "Booking tidak ditemukan"}
      </p>
    );
  }

  const p = data.pricing;
  const waiting = data.bookingStatus === "pending_payment";
  const underReview = data.bookingStatus === "under_review";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <p className="text-sm text-neutral-500">Kode booking</p>
        <h1 className="text-3xl font-bold">{data.bookingCode}</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Simpan halaman ini. Link-nya adalah akses Anda ke booking.
        </p>
      </div>

      {waiting && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            countdown.expired
              ? "bg-red-50 text-red-700"
              : "bg-orange-50 text-orange-800"
          }`}
        >
          <Clock className="h-4 w-4" />
          {countdown.expired
            ? "Batas waktu pembayaran sudah lewat. Silakan buat booking baru."
            : `Selesaikan pembayaran dalam ${countdown.text}`}
        </div>
      )}
      {data.bookingStatus === "expired" && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Booking ini kedaluwarsa karena pembayaran tidak diterima tepat waktu.
          Silakan buat booking baru.
        </div>
      )}
      {waiting && data.rejectReason && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Pembayaran sebelumnya ditolak: {data.rejectReason}. Silakan unggah
          bukti yang benar.
        </div>
      )}

      <section className="space-y-2 rounded-xl border bg-white p-5 text-sm">
        <h2 className="font-semibold">Ringkasan</h2>
        <Row k="Motor" v={data.motorTypeName} />
        <Row k="Ambil" v={fmtDateTime(data.rentalPeriod.pickupAt)} />
        <Row k="Kembali" v={fmtDateTime(data.rentalPeriod.returnAt)} />
        <Row k="Durasi" v={`${data.rentalPeriod.duration} hari`} />
        <div className="border-t pt-2">
          <Row k="Total tagihan" v={formatRupiah(p.total)} bold />
        </div>
      </section>

      {waiting && !countdown.expired && (
        <>
          <IdentityUpload
            bookingCode={bookingCode}
            token={token}
            hasIdentity={data.hasIdentity}
            onDone={() =>
              qc.invalidateQueries({
                queryKey: ["booking", bookingCode, token],
              })
            }
          />
          <section className="space-y-3 rounded-xl border bg-white p-5 text-sm">
            <h2 className="font-semibold">
              Transfer {data.paymentType === "dp" ? "DP" : "pelunasan"}
            </h2>
            <p className="text-3xl font-bold text-primary">
              {formatRupiah(p.requiredPayment)}
            </p>
            <div className="rounded-lg bg-neutral-50 p-4">
              <p className="text-neutral-500">{data.paymentInfo.bankName}</p>
              <div className="flex items-center gap-3">
                <p className="text-xl font-semibold tracking-wide">
                  {data.paymentInfo.accountNumber}
                </p>
                <button
                  type="button"
                  onClick={copyAccount}
                  className="flex items-center gap-1 text-primary"
                >
                  <Copy className="h-4 w-4" /> {copied ? "Tersalin" : "Salin"}
                </button>
              </div>
              <p className="text-neutral-600">
                a.n. {data.paymentInfo.accountHolder}
                {data.paymentInfo.note && (
                  <p className="mt-1 text-neutral-600">
                    {data.paymentInfo.note}
                  </p>
                )}
              </p>
            </div>
            {data.paymentType === "dp" && (
              <p className="text-neutral-500">
                Sisa {formatRupiah(p.total - p.requiredPayment)} dibayar saat
                pengambilan motor.
              </p>
            )}
          </section>

          <section className="space-y-3 rounded-xl border bg-white p-5 text-sm">
            <h2 className="font-semibold">Unggah bukti transfer</h2>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white"
            />
            {fileError && <p className="text-red-600">{fileError}</p>}
            {file && (
              <p className="text-neutral-500">
                {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </p>
            )}
            {upload.isError && (
              <p className="rounded bg-red-50 p-2 text-red-700">
                {(upload.error as Error).message}
              </p>
            )}
            {!data.hasIdentity && (
              <p className="rounded bg-orange-50 p-2 text-orange-800">
                Unggah KTP/SIM di atas terlebih dahulu.
              </p>
            )}
            <Button
              className="w-full"
              disabled={!file || upload.isPending || !data.hasIdentity}
              onClick={() => upload.mutate()}
            >
              {upload.isPending ? "Mengunggah..." : "Kirim Bukti Pembayaran"}
            </Button>
          </section>
        </>
      )}

      {underReview && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5" />
          <div>
            <p className="font-semibold">Bukti pembayaran diterima</p>
            <p>
              Admin sedang memeriksa pembayaran Anda. Anda akan mendapat kabar
              setelah disetujui.
            </p>
          </div>
        </div>
      )}

      {["confirmed", "ongoing", "completed"].includes(data.bookingStatus) && (
        <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
          <p className="font-semibold">
            Pembayaran disetujui, booking Anda terkonfirmasi.
          </p>
          <Button
            render={
              <Link
                to={`/receipt/${bookingCode}?token=${encodeURIComponent(
                  token
                )}`}
              />
            }
          >
            Lihat bukti booking
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-3 ${bold ? "font-semibold" : ""}`}
    >
      <span className="text-neutral-500">{k}</span>
      <span>{v}</span>
    </div>
  );
}
