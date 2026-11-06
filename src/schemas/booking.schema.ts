import { z } from "zod";

export const bookingSchema = z
  .object({
    motorSlug: z.string().min(1, "Pilih tipe motor"),
    pickupAt: z.string().min(1, "Isi waktu pengambilan"),
    returnAt: z.string().min(1, "Isi waktu pengembalian"),
    name: z.string().trim().min(3, "Nama minimal 3 karakter"),
    whatsapp: z
      .string()
      .trim()
      .regex(
        /^(\+?62|0)8\d{7,12}$/,
        "Nomor WhatsApp tidak valid, contoh 08123456789"
      ),
    email: z.union([z.literal(""), z.string().email("Email tidak valid")]),
    address: z.string().trim().min(5, "Alamat wajib diisi"),
    paymentType: z.enum(["dp", "full"]),
    agree: z.boolean().refine((v) => v, "Anda harus menyetujui syarat sewa"),
  })
  .superRefine((v, ctx) => {
    const p = new Date(v.pickupAt);
    const r = new Date(v.returnAt);
    if (v.pickupAt && p.getTime() < Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["pickupAt"],
        message: "Waktu pengambilan tidak boleh di masa lalu",
      });
    }
    if (v.pickupAt && v.returnAt && r.getTime() <= p.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["returnAt"],
        message: "Pengembalian harus setelah pengambilan",
      });
    }
  });

export type BookingFormValues = z.infer<typeof bookingSchema>;
