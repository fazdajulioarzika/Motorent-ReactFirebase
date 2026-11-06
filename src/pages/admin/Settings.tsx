import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminGet, adminPost } from "@/lib/api";
import { normalizeWhatsapp } from "@/lib/phone";

interface Settings {
  rental: {
    name: string;
    address: string;
    whatsapp: string;
    email: string;
    openHour: number;
    closeHour: number;
  };
  payment: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    note: string;
  };
  policy: {
    dpPercent: number;
    depositAmount: number;
    toleranceMinutes: number;
    minDays: number;
    maxDays: number;
    paymentExpiryMinutes: number;
    lateFeePerHour: number;
  };
  notifications: { emailEnabled: boolean; remindersEnabled: boolean };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 text-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Text({
  label,
  value,
  onChange,
  wide,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminGet<Settings>("/admin/settings"),
  });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      adminPost("/admin/settings", {
        ...form,
        rental: {
          ...form!.rental,
          whatsapp: normalizeWhatsapp(form!.rental.whatsapp),
        },
      }),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["public-settings"] });
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const update = (section: keyof Settings, key: string, value: unknown) =>
    setForm((f) =>
      f ? ({ ...f, [section]: { ...f[section], [key]: value } } as Settings) : f
    );

  if (isLoading) return <p className="text-neutral-500">Memuat...</p>;
  if (error) return <p className="text-red-600">{(error as Error).message}</p>;
  if (!form) return null;

  const { rental, payment, policy, notifications } = form;

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Pengaturan</h1>

      <Section title="Profil rental">
        <Text
          label="Nama rental"
          value={rental.name}
          onChange={(v) => update("rental", "name", v)}
        />
        <Text
          label="WhatsApp"
          value={rental.whatsapp}
          placeholder="08123456789"
          onChange={(v) => update("rental", "whatsapp", v)}
        />
        <Text
          label="Email (opsional)"
          value={rental.email}
          onChange={(v) => update("rental", "email", v)}
        />
        <div />
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Alamat</Label>
          <Textarea
            rows={2}
            value={rental.address}
            onChange={(e) => update("rental", "address", e.target.value)}
          />
        </div>
        <Num
          label="Jam buka (0 sampai 23)"
          value={rental.openHour}
          onChange={(v) => update("rental", "openHour", v)}
        />
        <Num
          label="Jam tutup (0 sampai 23)"
          value={rental.closeHour}
          onChange={(v) => update("rental", "closeHour", v)}
        />
      </Section>

      <Section title="Rekening pembayaran">
        <Text
          label="Nama bank"
          value={payment.bankName}
          onChange={(v) => update("payment", "bankName", v)}
        />
        <Text
          label="Nomor rekening"
          value={payment.accountNumber}
          onChange={(v) => update("payment", "accountNumber", v)}
        />
        <Text
          label="Nama pemilik"
          value={payment.accountHolder}
          onChange={(v) => update("payment", "accountHolder", v)}
          wide
        />
        <div className="space-y-1.5 sm:col-span-2">
          <Label>
            Catatan pembayaran (tampil di halaman bayar, mis. info QRIS)
          </Label>
          <Textarea
            rows={2}
            value={payment.note}
            onChange={(e) => update("payment", "note", e.target.value)}
          />
        </div>
      </Section>

      <Section title="Kebijakan sewa">
        <Num
          label="DP (% dari biaya sewa)"
          value={policy.dpPercent}
          onChange={(v) => update("policy", "dpPercent", v)}
        />
        <Num
          label="Batas waktu bayar (menit)"
          value={policy.paymentExpiryMinutes}
          onChange={(v) => update("policy", "paymentExpiryMinutes", v)}
        />
        <Num
          label="Toleransi keterlambatan (menit)"
          value={policy.toleranceMinutes}
          onChange={(v) => update("policy", "toleranceMinutes", v)}
          hint="Dipakai untuk pembulatan durasi dan denda."
        />
        <Num
          label="Denda per jam (Rp)"
          value={policy.lateFeePerHour}
          onChange={(v) => update("policy", "lateFeePerHour", v)}
          hint="Hanya saran di form pengembalian."
        />
        <Num
          label="Minimal sewa (hari)"
          value={policy.minDays}
          onChange={(v) => update("policy", "minDays", v)}
        />
        <Num
          label="Maksimal sewa (hari)"
          value={policy.maxDays}
          onChange={(v) => update("policy", "maxDays", v)}
        />
      </Section>

      <section className="space-y-3 rounded-xl border bg-white p-5 text-sm">
        <h2 className="font-semibold">Notifikasi</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={notifications.emailEnabled}
            onChange={(e) =>
              update("notifications", "emailEnabled", e.target.checked)
            }
          />
          Kirim email ke pelanggan
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={notifications.remindersEnabled}
            onChange={(e) =>
              update("notifications", "remindersEnabled", e.target.checked)
            }
          />
          Kirim pengingat pengambilan dan pengembalian
        </label>
      </section>

      {save.isError && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">
          {(save.error as Error).message}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Menyimpan..." : "Simpan pengaturan"}
        </Button>
        {saved && <span className="text-sm text-green-700">Tersimpan</span>}
      </div>
    </div>
  );
}
