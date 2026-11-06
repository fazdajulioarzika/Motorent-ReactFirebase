import { ChevronDown } from "lucide-react";
import { useSettings } from "@/lib/useSettings";

export default function Faq() {
  const { policy } = useSettings();
  const items = [
    {
      q: "Apakah saya perlu membuat akun?",
      a: "Tidak. Anda cukup mengisi data saat booking. Simpan tautan pembayaran atau gunakan menu Lacak Booking dengan kode booking dan nomor WhatsApp.",
    },
    {
      q: "Berapa DP yang harus dibayar?",
      a: `DP sebesar ${policy.dpPercent}% dari biaya sewa. Anda juga bisa membayar lunas di awal. Sisa pembayaran dilunasi saat motor diambil.`,
    },
    {
      q: "Berapa lama batas waktu pembayaran?",
      a: `${policy.paymentExpiryMinutes} menit setelah booking dibuat. Jika lewat, booking kedaluwarsa dan Anda perlu memesan ulang.`,
    },
    {
      q: "Bagaimana durasi sewa dihitung?",
      a: `Per 24 jam sejak waktu pengambilan, dengan toleransi ${policy.toleranceMinutes} menit. Lewat dari toleransi dihitung 1 hari tambahan.`,
    },
    {
      q: "Dokumen apa yang perlu disiapkan?",
      a: "Foto KTP atau SIM untuk diunggah saat booking, dan dokumen asli saat pengambilan motor.",
    },
    {
      q: "Apakah saya bisa memilih nomor plat?",
      a: "Anda memilih tipe motor. Nomor plat dan unit ditetapkan petugas saat motor diambil.",
    },
    {
      q: "Bagaimana jika saya ingin membatalkan?",
      a: "Hubungi kami lewat WhatsApp dengan menyebut kode booking. Pengembalian dana mengikuti ketentuan pada halaman Syarat Sewa.",
    },
  ];

  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-14">
      <h2 className="text-2xl font-bold">Pertanyaan Umum</h2>
      <div className="mt-6 divide-y rounded-xl border bg-white">
        {items.map((it) => (
          <details key={it.q} className="group p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
              {it.q}
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-neutral-600">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
