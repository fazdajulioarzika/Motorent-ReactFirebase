import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { formatRupiah } from "@/lib/format";

interface ReceiptData {
  bookingCode: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentType: "dp" | "full";
  customerName: string;
  customerWhatsapp: string;
  motorTypeName: string;
  rentalPeriod: { pickupAt: string; returnAt: string; duration: number };
  pricing: { total: number; paidAmount: number; remainingAmount: number };
  rental: { name: string; address: string; whatsapp: string };
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));

export default function Receipt() {
  const { bookingCode = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["receipt", bookingCode, token],
    queryFn: () =>
      apiGet<ReceiptData>(
        `/bookings/${bookingCode}/receipt?token=${encodeURIComponent(token)}`
      ),
    enabled: !!token,
    retry: false,
  });

  if (!token)
    return (
      <p className="p-10 text-center text-neutral-600">
        Link bukti booking tidak lengkap.
      </p>
    );
  if (isLoading)
    return <p className="p-10 text-center text-neutral-500">Memuat...</p>;
  if (error || !data) {
    return (
      <p className="p-10 text-center text-red-600">
        {(error as Error)?.message ?? "Tidak ditemukan"}
      </p>
    );
  }

  const lunas = data.pricing.remainingAmount <= 0;
  const p = data.pricing;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-primary">{data.rental.name}</p>
            <p className="text-sm text-neutral-500">Bukti Booking</p>
            <p className="mt-2 text-2xl font-bold">{data.bookingCode}</p>
          </div>
          <QRCodeSVG value={window.location.href} size={96} />
        </div>

        <div
          className={`rounded-lg p-3 text-sm font-semibold ${
            lunas
              ? "bg-green-50 text-green-800"
              : "bg-orange-50 text-orange-800"
          }`}
        >
          {lunas
            ? "LUNAS"
            : `BELUM LUNAS. Sisa pembayaran ${formatRupiah(
                p.remainingAmount
              )} dibayar saat pengambilan motor.`}
        </div>

        <dl className="space-y-2 text-sm">
          <Row k="Penyewa" v={data.customerName} />
          <Row k="WhatsApp" v={data.customerWhatsapp} />
          <Row k="Motor" v={data.motorTypeName} />
          <Row k="Ambil" v={fmt(data.rentalPeriod.pickupAt)} />
          <Row k="Kembali" v={fmt(data.rentalPeriod.returnAt)} />
          <Row k="Durasi" v={`${data.rentalPeriod.duration} hari`} />
        </dl>

        <dl className="space-y-2 border-t pt-4 text-sm">
          <Row k="Total tagihan" v={formatRupiah(p.total)} />
          <Row k="Sudah dibayar" v={formatRupiah(p.paidAmount)} />
          <Row k="Sisa pembayaran" v={formatRupiah(p.remainingAmount)} bold />
        </dl>

        <div className="border-t pt-4 text-sm text-neutral-600">
          <p className="font-medium text-neutral-900">Lokasi pengambilan</p>
          <p>{data.rental.address}</p>
          <p>WhatsApp: {data.rental.whatsapp}</p>
        </div>

        <p className="text-xs text-neutral-500">
          Bukti booking ini bukan bukti pelunasan kecuali tertulis LUNAS. Nomor
          plat ditetapkan petugas saat motor diambil. Bawa KTP/SIM asli.
        </p>
      </div>

      <Button
        className="mt-4 w-full print:hidden"
        onClick={() => window.print()}
      >
        <Printer className="mr-2 h-4 w-4" /> Unduh / Cetak PDF
      </Button>
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
