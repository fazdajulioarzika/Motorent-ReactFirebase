import { Bike, CalendarDays, CreditCard, KeyRound } from "lucide-react";

const STEPS = [
  {
    icon: Bike,
    title: "Pilih motor",
    text: "Lihat daftar motor dan pilih tipe yang sesuai kebutuhan Anda.",
  },
  {
    icon: CalendarDays,
    title: "Tentukan jadwal",
    text: "Pilih tanggal dan jam, harga langsung terhitung otomatis.",
  },
  {
    icon: CreditCard,
    title: "Bayar DP atau lunas",
    text: "Transfer, lalu unggah KTP/SIM dan bukti pembayaran.",
  },
  {
    icon: KeyRound,
    title: "Ambil motor",
    text: "Setelah disetujui, tunjukkan bukti booking dan ambil motor.",
  },
];

export default function HowItWorks() {
  return (
    <section id="cara-sewa" className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-2xl font-bold">Cara Sewa</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <div key={title} className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-neutral-400">
                Langkah {i + 1}
              </span>
            </div>
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-neutral-500">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
