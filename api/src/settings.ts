/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { Firestore, type Env } from './firestore';

const hour = z.number().int().min(0).max(23);

export const settingsSchema = z
	.object({
		rental: z.object({
			name: z.string().trim().min(2, 'Nama rental wajib diisi').max(60),
			address: z.string().trim().min(5, 'Alamat wajib diisi').max(300),
			whatsapp: z.string().regex(/^628\d{7,12}$/, 'WhatsApp harus berformat 628xxxxxxxxxx'),
			email: z.union([z.literal(''), z.string().email('Email rental tidak valid')]),
			openHour: hour,
			closeHour: hour,
		}),
		payment: z.object({
			bankName: z.string().trim().min(2, 'Nama bank wajib diisi').max(40),
			accountNumber: z
				.string()
				.trim()
				.regex(/^[0-9\- ]{5,30}$/, 'Nomor rekening tidak valid'),
			accountHolder: z.string().trim().min(2, 'Nama pemilik rekening wajib diisi').max(80),
			note: z.string().trim().max(300),
		}),
		policy: z.object({
			dpPercent: z.number().int().min(10, 'DP minimal 10%').max(100),
			depositAmount: z.number().int().min(0).max(5_000_000),
			toleranceMinutes: z.number().int().min(0).max(240),
			minDays: z.number().int().min(1).max(30),
			maxDays: z.number().int().min(1).max(90),
			paymentExpiryMinutes: z.number().int().min(15, 'Batas bayar minimal 15 menit').max(1440),
			lateFeePerHour: z.number().int().min(0).max(1_000_000),
		}),
		notifications: z.object({
			emailEnabled: z.boolean(),
			remindersEnabled: z.boolean(),
		}),
	})
	.superRefine((v, ctx) => {
		if (v.rental.closeHour <= v.rental.openHour) {
			ctx.addIssue({ code: 'custom', path: ['rental', 'closeHour'], message: 'Jam tutup harus setelah jam buka' });
		}
		if (v.policy.maxDays < v.policy.minDays) {
			ctx.addIssue({ code: 'custom', path: ['policy', 'maxDays'], message: 'Maksimal hari harus >= minimal hari' });
		}
	});

export type Settings = z.infer<typeof settingsSchema>;

/** Nilai awal sebelum admin menyimpan pengaturan; mengambil dari vars lama bila ada. */
function defaults(env: Env): Settings {
	return {
		rental: {
			name: env.RENTAL_NAME || 'MotoRent',
			address: env.RENTAL_ADDRESS || '',
			whatsapp: env.RENTAL_WHATSAPP || '',
			email: '',
			openHour: 7,
			closeHour: 21,
		},
		payment: {
			bankName: env.BANK_NAME || '',
			accountNumber: env.BANK_ACCOUNT || '',
			accountHolder: env.BANK_HOLDER || '',
			note: '',
		},
		policy: {
			dpPercent: 30,
			depositAmount: 0,
			toleranceMinutes: 60,
			minDays: 1,
			maxDays: 30,
			paymentExpiryMinutes: 120,
			lateFeePerHour: 10000,
		},
		notifications: { emailEnabled: true, remindersEnabled: true },
	};
}

function merge(d: Settings, s: Record<string, any> | null): Settings {
	return {
		rental: { ...d.rental, ...(s?.rental ?? {}) },
		payment: { ...d.payment, ...(s?.payment ?? {}) },
		policy: { ...d.policy, ...(s?.policy ?? {}) },
		notifications: { ...d.notifications, ...(s?.notifications ?? {}) },
	};
}

let cache: { at: number; value: Settings } | null = null;

/** Cache 30 detik per isolate untuk menghemat pembacaan Firestore. */
export async function getSettings(env: Env, fs: Firestore = new Firestore(env), fresh = false): Promise<Settings> {
	if (!fresh && cache && Date.now() - cache.at < 30_000) return cache.value;
	const doc = await fs.get('settings/main');
	const value = merge(defaults(env), doc);
	cache = { at: Date.now(), value };
	return value;
}

const isAdmin = (c: any) => ['super_admin', 'admin'].includes(c.get('staff').role);

export async function handleGetSettings(c: any) {
	if (!isAdmin(c)) return c.json({ error: 'Hanya admin yang boleh membuka pengaturan' }, 403);
	try {
		return c.json(await getSettings(c.env, new Firestore(c.env), true));
	} catch (e) {
		console.error(e);
		return c.json({ error: 'Gagal memuat pengaturan' }, 500);
	}
}

export async function handleSaveSettings(c: any) {
	if (!isAdmin(c)) return c.json({ error: 'Hanya admin yang boleh mengubah pengaturan' }, 403);
	const parsed = settingsSchema.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	}
	const v = parsed.data;
	const now = new Date();
	try {
		await new Firestore(c.env).commit([
			{ path: 'settings/main', data: { ...v, updatedAt: now, updatedBy: c.get('staff').uid } },
			{
				// Tanpa rekening dan catatan pembayaran: dokumen ini terbaca publik.
				path: 'settings/public',
				data: { rental: v.rental, policy: v.policy, updatedAt: now },
			},
		]);
		cache = null;
		return c.json({ ok: true });
	} catch (e) {
		console.error(e);
		return c.json({ error: 'Gagal menyimpan pengaturan' }, 500);
	}
}
