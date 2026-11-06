import LegalPage, { LegalSection } from "@/components/public/LegalPage";
import { useSettings } from "@/lib/useSettings";

export default function PrivacyPolicy() {
  const { rental } = useSettings();
  return (
    <LegalPage title="Kebijakan Privasi" updated="6 November 2026">
      <LegalSection title="1. Data yang kami kumpulkan">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Nama, nomor WhatsApp, email (opsional), dan alamat yang Anda isi
            saat booking.
          </li>
          <li>Foto KTP atau SIM, serta bukti transfer pembayaran.</li>
          <li>
            Data sewa: tipe motor, jadwal, pembayaran, dan kondisi motor saat
            diambil dan dikembalikan.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Cara kami memakai data">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Memproses booking, memverifikasi pembayaran dan identitas, serta
            menyerahkan motor.
          </li>
          <li>
            Mengirim notifikasi status booking dan pengingat jadwal lewat email.
          </li>
          <li>Menyusun laporan operasional dan keuangan internal.</li>
          <li>
            Kami tidak menjual data Anda dan tidak memakainya untuk iklan pihak
            ketiga.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Penyimpanan dan keamanan">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Data booking disimpan di database yang tidak dapat dibaca publik.
            Hanya admin dan staf berwenang yang dapat mengaksesnya.
          </li>
          <li>
            Foto KTP/SIM dan bukti transfer disimpan di penyimpanan privat tanpa
            tautan publik. Setiap pembukaan dokumen identitas oleh petugas
            dicatat.
          </li>
          <li>
            Halaman pembayaran dan bukti booking hanya dapat dibuka dengan
            tautan unik yang kami kirim kepada Anda. Jaga kerahasiaan tautan
            tersebut.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Lama penyimpanan">
        <p>
          Foto KTP/SIM dihapus otomatis 30 hari setelah booking selesai,
          dibatalkan, atau kedaluwarsa. Data transaksi disimpan lebih lama untuk
          keperluan pembukuan dan penyelesaian sengketa.
        </p>
      </LegalSection>

      <LegalSection title="5. Layanan pihak ketiga">
        <p>
          Kami memakai penyedia layanan untuk hosting dan database (Google
          Firebase), pemrosesan server (Cloudflare), penyimpanan file
          (Cloudinary), dan pengiriman email (Resend). Data hanya diteruskan
          sebatas yang diperlukan agar layanan berjalan.
        </p>
      </LegalSection>

      <LegalSection title="6. Hak Anda">
        <p>
          Anda dapat meminta salinan, koreksi, atau penghapusan data pribadi
          dengan menghubungi {rental.name}
          {rental.whatsapp && ` di WhatsApp ${rental.whatsapp}`}
          {rental.email && ` atau email ${rental.email}`}. Permintaan
          penghapusan dapat tertahan untuk data yang wajib disimpan demi
          pembukuan.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
