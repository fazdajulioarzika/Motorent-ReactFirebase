/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { Firestore } from './firestore';
import { safeEqual, sha256Hex } from './crypto';
import { getSettings } from './settings';

const MAX_FAILS = 10;
const GENERIC = 'Kode booking atau nomor WhatsApp tidak cocok';

const input = z.object({
	bookingCode: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^MR-\d{8}-\d{3,}$/, 'Format kode booking tidak valid'),
	whatsapp: z.string().trim().min(8, 'Isi nomor WhatsApp').max(20),
});

function normalizeWa(s: string): string {
	const d = s.replace(/\D/g, '');
	if (d.startsWith('62')) return d;
	if (d.startsWith('0')) return '62' + d.slice(1);
	return d;
}

async function limiterPath(c: any): Promise<string> {
	const ip = c.req.header('CF-Connecting-IP') ?? 'local';
	const hour = new Date().toISOString().slice(0, 13);
	return `rateLimits/track-${(await sha256Hex(ip + hour)).slice(0, 32)}`;
}

export async function handleTrack(c: any) {
	const parsed = input.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	}

	const fs = new Firestore(c.env);
	const path = await limiterPath(c);
	const bucket = await fs.get(path);
	const fails = Number(bucket?.n ?? 0);
	if (fails >= MAX_FAILS) {
		return c.json({ error: 'Terlalu banyak percobaan. Coba lagi dalam satu jam.' }, 429);
	}

	const b = await fs.get(`bookings/${parsed.data.bookingCode}`);
	const ok = b && safeEqual(normalizeWa(parsed.data.whatsapp), String(b.customer?.whatsapp ?? ''));
	if (!b || !ok) {
		await fs.commit([{ path, data: { n: fails + 1, expireAt: new Date(Date.now() + 2 * 3600 * 1000) } }]).catch(() => {});
		return c.json({ error: GENERIC }, 404);
	}

	const expired = b.bookingStatus === 'pending_payment' && b.expiresAt instanceof Date && b.expiresAt.getTime() <= Date.now();
	const s = await getSettings(c.env, fs);

	return c.json({
		bookingCode: b.bookingCode,
		motorTypeName: b.motorTypeName,
		rentalPeriod: b.rentalPeriod,
		pricing: {
			total: b.pricing?.total,
			requiredPayment: b.pricing?.requiredPayment,
			paidAmount: b.pricing?.paidAmount,
			remainingAmount: b.pricing?.remainingAmount,
		},
		paymentType: b.paymentType,
		bookingStatus: expired ? 'expired' : b.bookingStatus,
		rejectReason: b.rejectReason ?? null,
		expiresAt: b.expiresAt,
		contactWhatsapp: s.rental.whatsapp,
	});
}
