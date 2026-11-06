import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  bookingSchema,
  type BookingFormValues,
} from "@/schemas/booking.schema";
import { getActiveMotors } from "@/services/motorService";
import { calculateDuration, calculatePricing } from "@/lib/pricing";
import { formatRupiah } from "@/lib/format";
import { normalizeWhatsapp } from "@/lib/phone";
import { useSettings } from "@/lib/useSettings";
import { apiPost } from "@/lib/api";
import DateTimeRangePicker from "@/components/booking/DateTimeRangePicker";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function Booking() {
  const { rental, policy } = useSettings();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const { data: motors = [] } = useQuery({
    queryKey: ["motors"],
    queryFn: getActiveMotors,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      motorSlug: params.get("motor") ?? "",
      pickupAt: "",
      returnAt: "",
      name: "",
      whatsapp: "",
      email: "",
      address: "",
      paymentType: "dp",
      agree: false,
    },
  });

  const [motorSlug, pickupAt, returnAt, paymentType] = watch([
    "motorSlug",
    "pickupAt",
    "returnAt",
    "paymentType",
  ]);
  const motor = motors.find((m) => m.slug === motorSlug);
  const duration =
    pickupAt && returnAt
      ? calculateDuration(new Date(pickupAt), new Date(returnAt), policy)
      : 0;
  const pricing =
    motor && duration > 0
      ? calculatePricing(motor.dailyPrice, duration, paymentType, policy)
      : null;

  async function onSubmit(v: BookingFormValues) {
    setServerError("");
    try {
      const res = await apiPost<{ bookingCode: string; accessToken: string }>(
        "/bookings",
        {
          ...v,
          whatsapp: normalizeWhatsapp(v.whatsapp),
          pickupAt: new Date(v.pickupAt).toISOString(),
          returnAt: new Date(v.returnAt).toISOString(),
        }
      );
      navigate(`/payment/${res.bookingCode}?token=${res.accessToken}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Gagal membuat booking");
    }
  }

  const selectClass = "h-9 w-full rounded-md border bg-white px-3 text-sm";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Form Booking</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]"
      >
        <div className="space-y-5">
          <Field label="Tipe motor" error={errors.motorSlug?.message}>
            <select className={selectClass} {...register("motorSlug")}>
              <option value="">Pilih motor...</option>
              {motors.map((m) => (
                <option key={m.id} value={m.slug}>
                  {m.name} ({formatRupiah(m.dailyPrice)}/hari)
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4">
            <Field
              label="Tanggal & jam sewa"
              error={errors.pickupAt?.message ?? errors.returnAt?.message}
            >
              <DateTimeRangePicker
                pickupAt={pickupAt}
                returnAt={returnAt}
                openHour={rental.openHour}
                closeHour={rental.closeHour}
                onChange={(p, r) => {
                  setValue("pickupAt", p, { shouldValidate: isSubmitted });
                  setValue("returnAt", r, { shouldValidate: isSubmitted });
                }}
              />
            </Field>
          </div>

          <Field label="Nama lengkap" error={errors.name?.message}>
            <Input {...register("name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp" error={errors.whatsapp?.message}>
              <Input
                placeholder="08123456789"
                inputMode="tel"
                {...register("whatsapp")}
              />
            </Field>
            <Field label="Email (opsional)" error={errors.email?.message}>
              <Input type="email" {...register("email")} />
            </Field>
          </div>
          <Field label="Alamat" error={errors.address?.message}>
            <Textarea rows={3} {...register("address")} />
          </Field>

          <div className="space-y-2">
            <Label>Pembayaran</Label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="dp" {...register("paymentType")} />
              DP {policy.dpPercent}% dari biaya sewa
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="full" {...register("paymentType")} />
              Bayar lunas
            </label>
          </div>

          <div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" {...register("agree")} />
              Saya menyetujui{" "}
              <Link
                to="/terms"
                target="_blank"
                className="text-primary underline"
              >
                syarat sewa
              </Link>{" "}
              dan{" "}
              <Link
                to="/privacy-policy"
                target="_blank"
                className="text-primary underline"
              >
                kebijakan privasi
              </Link>
              .
            </label>
            {errors.agree && (
              <p className="mt-1 text-xs text-red-600">
                {errors.agree.message}
              </p>
            )}
          </div>
        </div>

        <aside className="h-fit space-y-3 rounded-xl border bg-white p-5 text-sm md:sticky md:top-24">
          <h2 className="font-semibold">Ringkasan</h2>
          {!pricing || !motor ? (
            <p className="text-neutral-500">
              Pilih motor dan isi tanggal untuk melihat harga.
            </p>
          ) : (
            <dl className="space-y-2">
              <Row k="Motor" v={motor.name} />
              <Row k="Durasi" v={`${pricing.duration} hari`} />
              <Row k="Tarif harian" v={formatRupiah(pricing.dailyPrice)} />
              <div className="border-t pt-2">
                <Row k="Total tagihan" v={formatRupiah(pricing.total)} bold />
              </div>
              <div className="rounded-lg bg-orange-50 p-3">
                <Row
                  k="Bayar sekarang"
                  v={formatRupiah(pricing.requiredPayment)}
                  bold
                />
                <Row
                  k="Sisa"
                  v={formatRupiah(pricing.total - pricing.requiredPayment)}
                />
              </div>
            </dl>
          )}
          <p className="text-xs text-neutral-500">
            Durasi dihitung per 24 jam sejak pengambilan, toleransi{" "}
            {policy.toleranceMinutes} menit. Bayar dalam{" "}
            {policy.paymentExpiryMinutes} menit setelah booking.
          </p>
          {serverError && (
            <p className="rounded bg-red-50 p-2 text-red-700">{serverError}</p>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Memproses..." : "Buat Booking"}
          </Button>
        </aside>
      </form>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-2 ${bold ? "font-semibold" : ""}`}
    >
      <dt className="text-neutral-500">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
