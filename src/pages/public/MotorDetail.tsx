import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import { getMotorBySlug } from "@/services/motorService";

export default function MotorDetail() {
  const { slug = "" } = useParams();
  const { data: motor, isLoading } = useQuery({
    queryKey: ["motor", slug],
    queryFn: () => getMotorBySlug(slug),
  });

  if (isLoading) return <p className="p-8 text-neutral-500">Memuat...</p>;
  if (!motor) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-neutral-500">Motor tidak ditemukan.</p>
        <Button className="mt-4" render={<Link to="/motor" />}>
          Kembali ke daftar
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-2">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
        {motor.images[0] ? (
          <img
            src={motor.images[0]}
            alt={motor.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Bike className="h-20 w-20 text-neutral-300" />
        )}
      </div>

      <div>
        <p className="text-sm capitalize text-neutral-500">
          {motor.brand} · {motor.category}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{motor.name}</h1>
        <p className="mt-4 text-3xl font-bold text-primary">
          {formatRupiah(motor.dailyPrice)}
          <span className="text-base font-normal text-neutral-500">
            {" "}
            / hari
          </span>
        </p>

        {motor.description && (
          <p className="mt-4 text-neutral-600">{motor.description}</p>
        )}

        <h2 className="mt-6 font-semibold">Spesifikasi</h2>
        <dl className="mt-2 divide-y rounded-lg border bg-white text-sm">
          {Object.entries(motor.specifications).map(([k, v]) => (
            <div key={k} className="flex justify-between px-4 py-2">
              <dt className="capitalize text-neutral-500">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <Button
          size="lg"
          className="mt-6 w-full"
          render={<Link to={`/booking?motor=${motor.slug}`} />}
        >
          Pesan Sekarang
        </Button>
        <p className="mt-2 text-xs text-neutral-500">
          Nomor plat ditetapkan petugas saat motor diambil.
        </p>
      </div>
    </div>
  );
}
