import LegalPage, { LegalSection } from "@/components/public/LegalPage";
import { formatRupiah } from "@/lib/format";
import { useSettings } from "@/lib/useSettings";

export default function Terms() {
  const { rental, policy } = useSettings();
  return (
    <LegalPage title="Syarat Sewa" updated="6 November 2026">
      <LegalSection title="1. Persyaratan penyewa">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Penyewa berusia minimal 17 tahun dan memiliki SIM C yang masih
            berlaku.
          </li>
          <li>
            Penyewa mengunggah foto KTP atau SIM saat booking dan membawa
            dokumen asli saat pengambilan motor.
          </li>
          <li>
            Data yang diisi harus benar. Petugas berhak menolak penyerahan motor
            jika identitas tidak cocok.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Pemesanan dan pembayaran">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Pemesanan dilakukan berdasarkan tipe motor. Nomor plat dan unit
            ditetapkan petugas saat motor diambil.
          </li>
          <li>
            Pembayaran dapat berupa DP ({policy.dpPercent}% dari biaya sewa)
            atau lunas, melalui transfer ke rekening {rental.name}.
          </li>
          <li>
            Pembayaran harus diterima dalam {policy.paymentExpiryMinutes} menit
            setelah booking dibuat. Lewat dari itu, booking kedaluwarsa dan stok
            dilepas.
          </li>
          <li>
            Booking terkonfirmasi setelah admin memeriksa dan menyetujui bukti
            pembayaran. Sisa pembayaran dilunasi saat motor diambil.
          </li>
          {policy.depositAmount > 0 && (
            <li>
              Deposit {formatRupiah(policy.depositAmount)} dikembalikan setelah
              motor kembali dalam kondisi baik.
            </li>
          )}
        </ul>
      </LegalSection>

      <LegalSection title="3. Durasi sewa dan keterlambatan">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Durasi dihitung per 24 jam sejak waktu pengambilan, dengan toleransi{" "}
            {policy.toleranceMinutes} menit. Kelebihan di atas toleransi
            dihitung 1 hari tambahan.
          </li>
          <li>
            Lama sewa minimal {policy.minDays} hari dan maksimal{" "}
            {policy.maxDays} hari per booking.
          </li>
          <li>
            Keterlambatan pengembalian melewati toleransi dapat dikenakan denda
            {policy.lateFeePerHour > 0 &&
              ` (acuan ${formatRupiah(policy.lateFeePerHour)} per jam)`}
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Penggunaan dan tanggung jawab">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Motor hanya dipakai oleh penyewa yang tercatat, tidak boleh
            disewakan ulang, dipindahtangankan, atau dipakai untuk kegiatan
            melanggar hukum.
          </li>
          <li>
            Penyewa bertanggung jawab atas kerusakan, kehilangan, dan
            pelanggaran lalu lintas selama masa sewa.
          </li>
          <li>
            Kondisi dan odometer dicatat petugas saat pengambilan dan
            pengembalian. Biaya kerusakan ditagih sesuai penilaian petugas.
          </li>
          <li>
            Bahan bakar dan perlengkapan keselamatan mengikuti ketentuan{" "}
            {rental.name}.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Pembatalan">
        <p>
          Pembatalan dilakukan dengan menghubungi {rental.name}. Pengembalian
          dana, jika ada, ditentukan oleh {rental.name}
          berdasarkan waktu pembatalan dan dicatat oleh admin. DP dapat hangus
          bila penyewa tidak datang tanpa kabar.
        </p>
      </LegalSection>

      <LegalSection title="6. Perubahan ketentuan">
        <p>
          Ketentuan ini dapat diperbarui sewaktu-waktu. Booking yang sudah
          dibuat mengikuti harga dan ketentuan saat booking dibuat.
        </p>
      </LegalSection>

      {rental.whatsapp && (
        <p className="text-neutral-500">
          Pertanyaan? Hubungi kami di WhatsApp {rental.whatsapp}.
        </p>
      )}
    </LegalPage>
  );
}
