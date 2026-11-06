import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUpload } from "@/lib/api";

interface Props {
  bookingCode: string;
  token: string;
  hasIdentity: boolean;
  onDone: () => void;
}

export default function IdentityUpload({
  bookingCode,
  token,
  hasIdentity,
  onDone,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [replace, setReplace] = useState(false);

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("token", token);
      form.append("file", file as File);
      return apiUpload(`/bookings/${bookingCode}/identity`, form);
    },
    onSuccess: () => {
      setFile(null);
      setReplace(false);
      onDone();
    },
  });

  function onPick(f: File | null) {
    setError("");
    if (!f) return setFile(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setFile(null);
      return setError("File harus JPG, PNG, atau WEBP");
    }
    if (f.size > 5 * 1024 * 1024) {
      setFile(null);
      return setError("Ukuran file maksimal 5 MB");
    }
    setFile(f);
  }

  if (hasIdentity && !replace) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <span className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" /> KTP/SIM sudah diunggah
        </span>
        <button
          type="button"
          className="underline"
          onClick={() => setReplace(true)}
        >
          Ganti foto
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border bg-white p-5 text-sm">
      <h2 className="font-semibold">Unggah KTP atau SIM</h2>
      <p className="text-neutral-500">
        Diperlukan sebelum mengirim bukti pembayaran. Foto harus jelas dan
        terbaca. Dokumen disimpan privat dan dihapus otomatis 30 hari setelah
        sewa selesai.
      </p>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white"
      />
      {error && <p className="text-red-600">{error}</p>}
      {upload.isError && (
        <p className="rounded bg-red-50 p-2 text-red-700">
          {(upload.error as Error).message}
        </p>
      )}
      <Button
        className="w-full"
        disabled={!file || upload.isPending}
        onClick={() => upload.mutate()}
      >
        {upload.isPending ? "Mengunggah..." : "Unggah dokumen"}
      </Button>
    </section>
  );
}
