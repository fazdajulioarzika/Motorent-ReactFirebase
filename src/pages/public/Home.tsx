import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, CalendarCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import MotorCard from "@/components/motor/MotorCard";
import { getActiveMotors } from "@/services/motorService";
import HeroSearch from "@/components/home/HeroSearch";
import HowItWorks from "@/components/home/HowItWorks";
import Faq from "@/components/home/Faq";
import Testimonials from "@/components/home/Testimonials";

const perks = [
  {
    icon: CalendarCheck,
    title: "Booking tanpa ribet",
    text: "Pilih tipe motor, tanggal, lalu bayar. Selesai.",
  },
  {
    icon: Wallet,
    title: "DP atau lunas",
    text: "Pilih cara bayar yang paling nyaman untuk Anda.",
  },
  {
    icon: ShieldCheck,
    title: "Bukti booking digital",
    text: "Dapatkan QR dan PDF setelah pembayaran disetujui.",
  },
];

export default function Home() {
  const { data: motors, isLoading } = useQuery({
    queryKey: ["motors"],
    queryFn: getActiveMotors,
  });

  return (
    <>
      <section className="relative isolate overflow-hidden bg-neutral-900 text-white">
        {/* Background image */}
        <img
          src="/img/hero-motorent.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />

        {/* Lapisan gelap */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-neutral-950/40 via-neutral-950/25 to-neutral-950/15" />

        <div className="mx-auto max-w-6xl px-4 py-24 md:py-32">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
            Sewa motor harian,{" "}
            <span className="text-primary">mudah dan transparan.</span>
          </h1>
          <p className="mt-4 max-w-xl text-neutral-200">
            Pilih motor, tentukan tanggal, bayar DP atau lunas tanpa ribet.
          </p>
          <Button
            size="lg"
            className="mt-8 hover:shadow-md/50 shadow-white hover:bg-primary transition-all duration-300"
            render={<Link to="/motor" />}
          >
            Lihat Daftar Motor
          </Button>
          <HeroSearch />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {perks.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border bg-white p-5">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <h2 className="text-2xl font-bold">Motor Pilihan</h2>
        {isLoading ? (
          <p className="mt-4 text-neutral-500">Memuat...</p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {motors?.slice(0, 3).map((m) => (
              <MotorCard key={m.id} motor={m} />
            ))}
          </div>
        )}
      </section>
      <HowItWorks />
      <Testimonials />
      <Faq />
    </>
  );
}
