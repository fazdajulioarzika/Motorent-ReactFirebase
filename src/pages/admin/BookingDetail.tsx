import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminBlob, adminGet, adminPost } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import {
  StatusBadge,
  fmtDate,
  type AdminBooking,
} from "@/pages/admin/Bookings";

interface AdminPayment {
  id: string;
  paymentType: "dp" | "full";
  amount: number;
  status: string;
  proofReference?: string;
  rejectReason?: string;
  createdAt: string;
}

function ProofImage({ paymentId }: { paymentId: string }) {
  const [src, setSrc] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let url = "";
    adminBlob(`/admin/payments/${paymentId}/proof`)
      .then((b) => {
        url = URL.createObjectURL(b);
        setSrc(url);
      })
      .catch((e: Error) => setErr(e.message));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [paymentId]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!src) return <p className="text-sm text-neutral-500">Memuat bukti...</p>;
  return (
    <a href={src} target="_blank" rel="noreferrer">
      <img
        src={src}
        alt="Bukti transfer"
        className="max-h-96 rounded-lg border"
      />
    </a>
  );
}

export default function BookingDetail() {
  const { code = "" } = useParams();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const makeLink = useMutation({
    mutationFn: () =>
      adminPost<{ receiptUrl: string }>(`/admin/bookings/${code}/receipt-link`),
    onSuccess: (r) => setReceiptUrl(r.receiptUrl),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-booking", code],
    queryFn: () =>
      adminGet<{ booking: AdminBooking; payments: AdminPayment[] }>(
        `/admin/bookings/${code}`
      ),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-booking", code] });
    qc.invalidateQueries({ queryKey: ["admin-bookings"] });
  };
  const approve = useMutation({
    mutationFn: (id: string) =>
      adminPost<{ receiptUrl: string | null }>(`/admin/payments/${id}/approve`),
    onSuccess: (r) => {
      if (r.receiptUrl) setReceiptUrl(r.receiptUrl);
      refresh();
    },
  });
  const reject = useMutation({
    mutationFn: (id: string) =>
      adminPost(`/admin/payments/${id}/reject`, { reason }),
    onSuccess: () => {
      setReason("");
      refresh();
    },
  });

  if (isLoading) return <p className="text-neutral-500">Memuat...</p>;
  if (error || !data)
    return (
      <p className="text-red-600">
        {(error as Error)?.message ?? "Tidak ditemukan"}
      </p>
    );

  const { booking: b, payments } = data;
  const busy = approve.isPending || reject.isPending;
  const actionError = (approve.error ?? reject.error) as Error | null;

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/admin/bookings" className="text-sm text-primary">
        ← Kembali
      </Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{b.bookingCode}</h1>
        <StatusBadge status={b.bookingStatus} />
      </div>

      <section className="space-y-2 rounded-xl border bg-white p-5 text-sm">
        <h2 className="font-semibold">Pelanggan</h2>
        <Row k="Nama" v={b.customer.name} />
        <Row k="WhatsApp" v={b.customer.whatsapp} />
        <Row k="Email" v={b.customer.email || "-"} />
        <Row k="Alamat" v={b.customer.address} />
        <a
          className="inline-block text-primary"
          target="_blank"
          rel="noreferrer"
          href={`https://wa.me/${b.customer.whatsapp}`}
        >
          Chat via WhatsApp
        </a>
      </section>

      <section className="space-y-2 rounded-xl border bg-white p-5 text-sm">
        <h2 className="font-semibold">Sewa</h2>
        <Row k="Motor" v={b.motorTypeName} />
        <Row k="Ambil" v={fmtDate(b.rentalPeriod.pickupAt)} />
        <Row k="Kembali" v={fmtDate(b.rentalPeriod.returnAt)} />
        <Row k="Durasi" v={`${b.rentalPeriod.duration} hari`} />
        <Row k="Total" v={formatRupiah(b.pricing.total)} />
        <Row k="Sudah dibayar" v={formatRupiah(b.pricing.paidAmount)} />
        <Row k="Sisa" v={formatRupiah(b.pricing.remainingAmount)} />
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5 text-sm">
        <h2 className="font-semibold">Pembayaran</h2>
        {payments.length === 0 && (
          <p className="text-neutral-500">Belum ada bukti pembayaran.</p>
        )}
        {payments.map((p) => (
          <div
            key={p.id}
            className="space-y-3 border-t pt-4 first:border-0 first:pt-0"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {(
                  {
                    dp: "DP",
                    full: "Lunas",
                    remaining: "Pelunasan",
                    fee: "Denda/biaya",
                    refund: "Refund",
                  } as Record<string, string>
                )[p.paymentType] ?? p.paymentType}{" "}
                · {formatRupiah(p.amount)}
              </p>
              <span className="text-neutral-500">
                {p.status} · {fmtDate(p.createdAt)}
              </span>
            </div>
            {p.proofReference && <ProofImage paymentId={p.id} />}
            {p.rejectReason && (
              <p className="text-red-600">Ditolak: {p.rejectReason}</p>
            )}

            {p.status === "under_review" && (
              <div className="space-y-2">
                <Button disabled={busy} onClick={() => approve.mutate(p.id)}>
                  {approve.isPending ? "Memproses..." : "Setujui pembayaran"}
                </Button>
                <div className="flex gap-2">
                  <Input
                    placeholder="Alasan penolakan (wajib)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={busy || reason.trim().length < 3}
                    onClick={() => reject.mutate(p.id)}
                  >
                    Tolak
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {actionError && (
          <p className="rounded bg-red-50 p-2 text-red-700">
            {actionError.message}
          </p>
        )}
      </section>
      {["confirmed", "ongoing", "completed"].includes(b.bookingStatus) && (
        <section className="space-y-3 rounded-xl border bg-white p-5 text-sm">
          <h2 className="font-semibold">Bukti booking</h2>
          <Button
            variant="outline"
            disabled={makeLink.isPending}
            onClick={() => makeLink.mutate()}
          >
            {receiptUrl ? "Buat link baru" : "Buat link bukti booking"}
          </Button>
          {makeLink.isError && (
            <p className="text-red-600">{(makeLink.error as Error).message}</p>
          )}
          {receiptUrl && (
            <div className="space-y-2">
              <Input
                readOnly
                value={receiptUrl}
                onFocus={(e) => e.target.select()}
              />
              <a
                className="inline-block text-primary"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/${
                  b.customer.whatsapp
                }?text=${encodeURIComponent(
                  `Halo ${b.customer.name}, booking ${b.bookingCode} sudah terkonfirmasi. Bukti booking: ${receiptUrl}`
                )}`}
              >
                Kirim via WhatsApp
              </a>
            </div>
          )}
        </section>
      )}
      {b.hasIdentity && <IdentitySection code={b.bookingCode} />}
      {!b.hasIdentity &&
        ["pending_payment", "under_review", "confirmed"].includes(
          b.bookingStatus
        ) && (
          <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800">
            Pelanggan belum mengunggah KTP/SIM.
          </p>
        )}
      <CancelSection
        code={b.bookingCode}
        status={b.bookingStatus}
        paid={b.pricing.paidAmount}
        onDone={refresh}
      />
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
const REASONS = [
  "Pelanggan tidak datang (no-show)",
  "Permintaan pelanggan",
  "Unit tidak tersedia",
  "Pembayaran bermasalah",
  "Lainnya",
];

function CancelSection({
  code,
  status,
  paid,
  onDone,
}: {
  code: string;
  status: string;
  paid: number;
  onDone: () => void;
}) {
  const [preset, setPreset] = useState(REASONS[0]);
  const [custom, setCustom] = useState("");
  const [refund, setRefund] = useState("0");

  const reason = preset === "Lainnya" ? custom.trim() : preset;
  const amount = Number(refund) || 0;

  const cancel = useMutation({
    mutationFn: () =>
      adminPost(`/admin/bookings/${code}/cancel`, {
        reason,
        refundAmount: amount,
      }),
    onSuccess: onDone,
  });

  if (!["pending_payment", "under_review", "confirmed"].includes(status))
    return null;

  const invalid = reason.length < 3 || amount < 0 || amount > paid;

  return (
    <section className="space-y-3 rounded-xl border border-red-200 bg-white p-5 text-sm">
      <h2 className="font-semibold text-red-700">Batalkan booking</h2>
      <select
        className="h-9 w-full rounded-md border bg-white px-3"
        value={preset}
        onChange={(e) => setPreset(e.target.value)}
      >
        {REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      {preset === "Lainnya" && (
        <Input
          placeholder="Tulis alasan (wajib)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
      )}
      {paid > 0 ? (
        <div className="space-y-1.5">
          <label className="text-neutral-600">
            Refund (Rp), sudah dibayar {formatRupiah(paid)}
          </label>
          <Input
            type="number"
            min={0}
            max={paid}
            value={refund}
            onChange={(e) => setRefund(e.target.value)}
          />
          {amount > paid && (
            <p className="text-red-600">Refund melebihi jumlah yang dibayar.</p>
          )}
          <p className="text-xs text-neutral-500">
            Transfer refund dilakukan manual. Isi 0 jika DP hangus.
          </p>
        </div>
      ) : (
        <p className="text-neutral-500">
          Belum ada pembayaran, tidak ada refund.
        </p>
      )}
      {cancel.isError && (
        <p className="rounded bg-red-50 p-2 text-red-700">
          {(cancel.error as Error).message}
        </p>
      )}
      <Button
        variant="outline"
        className="border-red-300 text-red-700"
        disabled={invalid || cancel.isPending}
        onClick={() => {
          if (
            window.confirm(
              `Batalkan booking ${code}? Tindakan ini tidak bisa diurungkan.`
            )
          )
            cancel.mutate();
        }}
      >
        {cancel.isPending ? "Memproses..." : "Batalkan booking"}
      </Button>
    </section>
  );
}
function IdentitySection({ code }: { code: string }) {
  const [src, setSrc] = useState("");
  const load = useMutation({
    mutationFn: () => adminBlob(`/admin/bookings/${code}/identity`),
    onSuccess: (b) => setSrc(URL.createObjectURL(b)),
  });

  useEffect(
    () => () => {
      if (src) URL.revokeObjectURL(src);
    },
    [src]
  );

  return (
    <section className="space-y-3 rounded-xl border bg-white p-5 text-sm">
      <h2 className="font-semibold">KTP / SIM</h2>
      {!src ? (
        <>
          <Button
            variant="outline"
            disabled={load.isPending}
            onClick={() => load.mutate()}
          >
            {load.isPending ? "Memuat..." : "Tampilkan dokumen"}
          </Button>
          <p className="text-xs text-neutral-500">
            Setiap pembukaan dokumen dicatat di riwayat booking.
          </p>
        </>
      ) : (
        <a href={src} target="_blank" rel="noreferrer">
          <img src={src} alt="KTP/SIM" className="max-h-96 rounded-lg border" />
        </a>
      )}
      {load.isError && (
        <p className="text-red-600">{(load.error as Error).message}</p>
      )}
    </section>
  );
}
