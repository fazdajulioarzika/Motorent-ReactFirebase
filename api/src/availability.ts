/* eslint-disable @typescript-eslint/no-explicit-any */
import { Firestore } from './firestore';

const BLOCKING = ['pending_payment', 'under_review', 'confirmed', 'ongoing'];
const MAX_RANGE_MS = 60 * 24 * 3600 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

function blocks(b: Record<string, any>, now: number): boolean {
	if (!BLOCKING.includes(b.bookingStatus)) return false;
	if (b.bookingStatus === 'pending_payment' && b.expiresAt instanceof Date && b.expiresAt.getTime() <= now) {
		return false;
	}
	return true;
}

export async function handleAvailability(c: any) {
	const from = Date.parse(c.req.query('from') ?? '');
	const to = Date.parse(c.req.query('to') ?? '');
	if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
		return c.json({ error: 'Rentang tanggal tidak valid' }, 400);
	}
	if (to - from > MAX_RANGE_MS) return c.json({ error: 'Rentang maksimal 60 hari' }, 400);

	const key = `${from}|${to}`;
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < 30_000) return c.json(hit.value);

	try {
		const fs = new Firestore(c.env);
		const [units, bookings] = await Promise.all([fs.all('motorUnits', 500), fs.all('bookings', 2000)]);
		const now = Date.now();

		const capacity: Record<string, number> = {};
		for (const u of units) {
			if (u.status === 'available' || u.status === 'rented') {
				capacity[u.motorTypeId] = (capacity[u.motorTypeId] ?? 0) + 1;
			}
		}
		const used: Record<string, number> = {};
		for (const b of bookings) {
			const p = b.rentalPeriod?.pickupAt;
			const r = b.rentalPeriod?.returnAt;
			if (!(p instanceof Date) || !(r instanceof Date) || !blocks(b, now)) continue;
			if (p.getTime() < to && r.getTime() > from) {
				used[b.motorTypeId] = (used[b.motorTypeId] ?? 0) + 1;
			}
		}

		// Hanya jumlah tersisa yang dikirim; tidak ada data booking atau pelanggan.
		const types: Record<string, { available: number }> = {};
		for (const [slug, cap] of Object.entries(capacity)) {
			types[slug] = { available: Math.max(0, cap - (used[slug] ?? 0)) };
		}
		const value = { types };
		cache.set(key, { at: Date.now(), value });
		if (cache.size > 50) cache.delete(cache.keys().next().value as string);
		return c.json(value);
	} catch (e) {
		console.error(e);
		return c.json({ error: 'Gagal memeriksa ketersediaan' }, 500);
	}
}
