import { Clock, Mail, MapPin, MessageCircle } from "lucide-react";
import { useSettings } from "@/lib/useSettings";

export default function Contact() {
  const { rental } = useSettings();
  const hours = `${String(rental.openHour).padStart(2, "0")}.00 sampai ${String(
    rental.closeHour
  ).padStart(2, "0")}.00 WIB`;
  const row = "flex items-start gap-3";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12">
      <h1 className="text-3xl font-bold">Kontak</h1>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-5 text-sm">
          <div className={row}>
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Alamat</p>
              <p className="text-neutral-600">
                {rental.address || "Belum diisi"}
              </p>
            </div>
          </div>
          <div className={row}>
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Jam operasional</p>
              <p className="text-neutral-600">Setiap hari, {hours}</p>
            </div>
          </div>
          {rental.whatsapp && (
            <div className={row}>
              <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">WhatsApp</p>
                <a
                  className="text-primary"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/${
                    rental.whatsapp
                  }?text=${encodeURIComponent(
                    "Halo, saya ingin bertanya tentang sewa motor"
                  )}`}
                >
                  Chat sekarang ({rental.whatsapp})
                </a>
              </div>
            </div>
          )}
          {rental.email && (
            <div className={row}>
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Email</p>
                <a className="text-primary" href={`mailto:${rental.email}`}>
                  {rental.email}
                </a>
              </div>
            </div>
          )}
        </div>

        {rental.address && (
          <iframe
            title="Lokasi"
            loading="lazy"
            className="h-72 w-full rounded-xl border"
            src={`https://www.google.com/maps?q=${encodeURIComponent(
              rental.address
            )}&output=embed`}
          />
        )}
      </div>
    </div>
  );
}
