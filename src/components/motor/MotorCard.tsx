import { Link } from "react-router-dom";
import { Bike } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/format";
import type { MotorType } from "@/types";

interface Props {
  motor: MotorType;
  availability?: { available: number } | null;
}

export default function MotorCard({ motor, availability }: Props) {
  return (
    <Link
      to={`/motor/${motor.slug}`}
      className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-neutral-100">
        {motor.images[0] ? (
          <img
            src={motor.images[0]}
            alt={motor.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Bike className="h-12 w-12 text-neutral-300" />
        )}
        {availability && (
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium ${
              availability.available > 0
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {availability.available > 0 ? "Tersedia" : "Penuh di tanggal ini"}
          </span>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">{motor.name}</h3>
          <Badge variant="secondary" className="capitalize">
            {motor.category}
          </Badge>
        </div>
        <p className="text-sm text-neutral-500">{motor.brand}</p>
        <p className="text-lg font-bold text-primary">
          {formatRupiah(motor.dailyPrice)}
          <span className="text-sm font-normal text-neutral-500"> / hari</span>
        </p>
      </div>
    </Link>
  );
}
