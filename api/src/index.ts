/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { Firestore, HttpError, type Env } from './firestore';
import { randomToken, safeEqual, sha256Hex } from './crypto';
import { handleProof } from './proof';
import admin from './admin';
import { notifyBooking } from './notify';
import { runCron } from './cron';
import { calculateDuration, calculatePricing } from './pricing';
import { getSettings, type Settings } from './settings';
import { handleTrack } from './track';
import { handleIdentity } from './identity';
import { handleAvailability } from './availability';

class AppError extends Error {
	constructor(public status: 400 | 404 | 409, message: string) {
		super(message);
	}
}

const bookingInput = z.object({
	motorSlug: z.string().min(1, 'Pilih tipe motor'),
	pickupAt: z.string().datetime('Waktu pengambilan tidak valid'),
	returnAt: z.string().datetime('Waktu pengembalian tidak valid'),
	name: z.string().trim().min(3, 'Nama minimal 3 karakter').max(100),
	whatsapp: z.string().regex(/^628\d{7,12}$/, 'Nomor WhatsApp tidak valid'),
	email: z.union([z.literal(''), z.string().email('Email tidak valid')]),
	address: z.string().trim().min(5, 'Alamat wajib diisi').max(300),
	paymentType: z.enum(['dp', 'full']),
});
type BookingInput = z.infer<typeof bookingInput>;

const BLOCKING = ['pending_payment', 'under_review', 'confirmed', 'ongoing'];

function blocksCapacity(b: Record<string, any>, now: number): boolean {
	if (!BLOCKING.includes(b.bookingStatus)) return false;
	if (b.bookingStatus === 'pending_payment' && b.expiresAt instanceof Date && b.expiresAt.getTime() <= now) {
		return false; // reservasi kedaluwarsa tidak menahan stok
	}
	return true;
}

function jakartaDay(): string {
	return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
}

async function createBooking(fs: Firestore, input: BookingInput, cfg: Settings['policy']) {
	const pickup = new Date(input.pickupAt);
	const ret = new Date(input.returnAt);
	const now = Date.now();

	if (pickup.getTime() < now - 5 * 60000) {
		throw new AppError(400, 'Waktu pengambilan tidak boleh di masa lalu');
	}
	if (ret.getTime() <= pickup.getTime()) {
		throw new AppError(400, 'Pengembalian harus setelah pengambilan');
	}
	const duration = calculateDuration(pickup, ret, cfg);
	if (duration > cfg.maxDays) throw new AppError(400, `Maksimal sewa ${cfg.maxDays} hari`);

	const motor = await fs.get(`motorTypes/${input.motorSlug}`);
	if (!motor || motor.isActive !== true) throw new AppError(404, 'Tipe motor tidak ditemukan');

	const units = await fs.query('motorUnits', [['motorTypeId', input.motorSlug]]);
	const capacity = units.filter((u) => u.status === 'available' || u.status === 'rented').length;
	if (capacity === 0) throw new AppError(409, 'Motor ini sedang tidak tersedia');

	// Harga dihitung ulang di server, angka dari browser diabaikan.
	const pricing = calculatePricing(Number(motor.dailyPrice), duration, input.paymentType, cfg);
	const token = randomToken();
	const tokenHash = await sha256Hex(token);
	const day = jakartaDay();

	for (let attempt = 0; attempt < 4; attempt++) {
		const tx = await fs.begin();
		try {
			// Dokumen kunci per tipe motor: semua booking tipe yang sama saling
			// berebut dokumen ini, sehingga transaksi dipaksa berurutan.
			await fs.get(`capacityLocks/${input.motorSlug}`, tx);

			const existing = await fs.query('bookings', [['motorTypeId', input.motorSlug]], tx);
			const used = existing.filter(
				(b) =>
					blocksCapacity(b, now) &&
					b.rentalPeriod?.pickupAt instanceof Date &&
					b.rentalPeriod.pickupAt.getTime() < ret.getTime() &&
					b.rentalPeriod.returnAt.getTime() > pickup.getTime()
			).length;

			if (used >= capacity) {
				await fs.rollback(tx);
				throw new AppError(409, 'Motor tidak tersedia pada tanggal tersebut. Coba tanggal lain.');
			}

			const counter = await fs.get(`counters/booking-${day}`, tx);
			const n = (Number(counter?.n) || 0) + 1;
			const bookingCode = `MR-${day}-${String(n).padStart(3, '0')}`;
			const expiresAt = new Date(now + cfg.paymentExpiryMinutes * 60000);

			await fs.commit(
				[
					{ path: `capacityLocks/${input.motorSlug}`, data: { updatedAt: new Date(now), lastBooking: bookingCode } },
					{ path: `counters/booking-${day}`, data: { n } },
					{
						path: `bookings/${bookingCode}`,
						mustNotExist: true,
						data: {
							bookingCode,
							accessTokenHash: tokenHash,
							customer: {
								name: input.name,
								whatsapp: input.whatsapp,
								email: input.email,
								address: input.address,
							},
							motorTypeId: input.motorSlug,
							motorTypeName: motor.name,
							rentalPeriod: { pickupAt: pickup, returnAt: ret, duration },
							pricing,
							paymentType: input.paymentType,
							bookingStatus: 'pending_payment',
							paymentStatus: 'unpaid',
							expiresAt,
							createdAt: new Date(now),
							updatedAt: new Date(now),
						},
					},
				],
				tx
			);
			return { bookingCode, accessToken: token, expiresAt: expiresAt.toISOString(), pricing };
		} catch (e) {
			if (e instanceof AppError) throw e;
			if (e instanceof HttpError && e.status === 409) continue; // bentrok transaksi, ulangi
			await fs.rollback(tx).catch(() => {});
			throw e;
		}
	}
	throw new AppError(409, 'Sistem sedang sibuk, silakan coba lagi');
}

const app = new Hono<{ Bindings: Env }>();

app.use(
	'*',
	cors({
		origin: (origin, c) =>
			c.env.ALLOWED_ORIGINS.split(',')
				.map((s: string) => s.trim())
				.includes(origin)
				? origin
				: '',
		allowMethods: ['GET', 'POST', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization'],
	})
);

app.get('/', (c) => c.text('MotoRent API'));

app.post('/bookings', async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: 'Format data tidak valid' }, 400);
	}
	const parsed = bookingInput.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	}
	try {
		const fs = new Firestore(c.env);
		const settings = await getSettings(c.env, fs);
		const result = await createBooking(fs, parsed.data, settings.policy);
		const d = parsed.data;
		c.executionCtx.waitUntil(
			notifyBooking(c.env, 'created', {
				bookingCode: result.bookingCode,
				name: d.name,
				email: d.email,
				motorName: d.motorSlug,
				pickupAt: new Date(d.pickupAt),
				returnAt: new Date(d.returnAt),
				total: result.pricing.total,
				amount: result.pricing.requiredPayment,
				expiresAt: new Date(result.expiresAt),
				link: `${c.env.APP_URL}/payment/${result.bookingCode}?token=${result.accessToken}`,
			})
		);
		return c.json(result, 201);
	} catch (e) {
		if (e instanceof AppError) return c.json({ error: e.message }, e.status);
		console.error(e);
		return c.json({ error: 'Server sedang bermasalah, coba lagi sebentar' }, 500 as never);
	}
});

app.get('/bookings/:code', async (c) => {
	const s = await getSettings(c.env);
	const token = c.req.query('token') ?? '';
	if (!token) return c.json({ error: 'Token wajib diisi' }, 401);

	const b = await new Firestore(c.env).get(`bookings/${c.req.param('code')}`);
	const ok = b && safeEqual(await sha256Hex(token), String(b.accessTokenHash));
	if (!b || !ok) return c.json({ error: 'Booking tidak ditemukan atau token salah' }, 404);

	return c.json({
		bookingCode: b.bookingCode,
		motorTypeName: b.motorTypeName,
		customerName: b.customer?.name,
		rentalPeriod: b.rentalPeriod,
		pricing: b.pricing,
		paymentType: b.paymentType,
		bookingStatus: b.bookingStatus,
		paymentStatus: b.paymentStatus,
		expiresAt: b.expiresAt,
		hasIdentity: !!b.identityReference,
		rejectReason: b.rejectReason ?? null,
		paymentInfo: {
			bankName: s.payment.bankName,
			accountNumber: s.payment.accountNumber,
			accountHolder: s.payment.accountHolder,
			note: s.payment.note,
		},
	});
});
app.get('/bookings/:code/receipt', async (c) => {
	const token = c.req.query('token') ?? '';
	if (!token) return c.json({ error: 'Token wajib diisi' }, 401);

	const b = await new Firestore(c.env).get(`bookings/${c.req.param('code')}`);
	if (!b) return c.json({ error: 'Bukti booking tidak ditemukan' }, 404);

	const h = await sha256Hex(token);
	const hashes = [b.accessTokenHash, ...(b.receiptTokenHashes ?? [])].map(String);
	if (!hashes.some((x) => safeEqual(h, x))) {
		return c.json({ error: 'Bukti booking tidak ditemukan' }, 404);
	}
	if (!['confirmed', 'ongoing', 'completed'].includes(b.bookingStatus)) {
		return c.json({ error: 'Bukti booking terbit setelah pembayaran disetujui admin' }, 409);
	}
	const s = await getSettings(c.env);
	return c.json({
		bookingCode: b.bookingCode,
		bookingStatus: b.bookingStatus,
		paymentStatus: b.paymentStatus,
		paymentType: b.paymentType,
		customerName: b.customer?.name,
		customerWhatsapp: b.customer?.whatsapp,
		motorTypeName: b.motorTypeName,
		rentalPeriod: b.rentalPeriod,
		pricing: {
			total: b.pricing?.total,
			paidAmount: b.pricing?.paidAmount,
			remainingAmount: b.pricing?.remainingAmount,
		},
		rental: { name: s.rental.name, address: s.rental.address, whatsapp: s.rental.whatsapp },
	});
});
app.post('/bookings/:code/proof', handleProof);
app.post('/bookings/:code/identity', handleIdentity);
app.get('/availability', handleAvailability);
app.post('/track', handleTrack);
app.route('/admin', admin);

export default {
	fetch: app.fetch,
	scheduled(_event: unknown, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(runCron(env));
	},
};
