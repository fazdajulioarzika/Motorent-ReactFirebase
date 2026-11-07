/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { Firestore } from './firestore';

const WA = /^\d{8,15}$/;

const isAdmin = (c: any) => ['super_admin', 'admin'].includes(c.get('staff').role);
const denied = (c: any) => c.json({ error: 'Hanya admin yang boleh membuka data pelanggan' }, 403);

function effectiveStatus(b: Record<string, any>, now: number): string {
	if (b.bookingStatus === 'pending_payment' && b.expiresAt instanceof Date && b.expiresAt.getTime() <= now) {
		return 'expired';
	}
	return String(b.bookingStatus);
}

/** Pembayaran disetujui per booking; refund mengurangi. */
function netByBooking(payments: Record<string, any>[]): Map<string, number> {
	const m = new Map<string, number>();
	for (const p of payments) {
		if (p.status !== 'approved') continue;
		const amount = Number(p.amount || 0);
		const signed = p.paymentType === 'refund' ? -amount : amount;
		m.set(String(p.bookingId), (m.get(String(p.bookingId)) ?? 0) + signed);
	}
	return m;
}

export async function listCustomers(c: any) {
	if (!isAdmin(c)) return denied(c);
	try {
		const fs = new Firestore(c.env);
		const [bookings, payments] = await Promise.all([fs.all('bookings', 2000), fs.all('payments', 2000)]);
		const net = netByBooking(payments);
		const now = Date.now();

		const map = new Map<string, any>();
		for (const b of bookings) {
			const wa = String(b.customer?.whatsapp ?? '');
			if (!WA.test(wa) || !(b.createdAt instanceof Date)) continue;
			const st = effectiveStatus(b, now);
			let cu = map.get(wa);
			if (!cu) {
				cu = {
					whatsapp: wa,
					name: '',
					email: '',
					lastBookingAt: new Date(0),
					bookings: 0,
					completed: 0,
					cancelled: 0,
					totalSpent: 0,
				};
				map.set(wa, cu);
			}
			cu.bookings += 1;
			if (st === 'completed') cu.completed += 1;
			if (st === 'cancelled') cu.cancelled += 1;
			cu.totalSpent += net.get(String(b.bookingCode)) ?? 0;
			if (b.createdAt.getTime() >= cu.lastBookingAt.getTime()) {
				cu.lastBookingAt = b.createdAt;
				cu.name = String(b.customer?.name ?? '');
				cu.email = String(b.customer?.email ?? '');
			}
		}

		const notes = await fs.all('customerNotes', 2000);
		const hasNote = new Set(notes.filter((n) => String(n.note ?? '').trim()).map((n) => n.id));

		return c.json(
			[...map.values()]
				.map((cu) => ({ ...cu, hasNote: hasNote.has(cu.whatsapp) }))
				.sort((a, b) => b.lastBookingAt.getTime() - a.lastBookingAt.getTime())
		);
	} catch (e) {
		console.error(e);
		return c.json({ error: 'Gagal memuat pelanggan' }, 500);
	}
}

export async function customerDetail(c: any) {
	if (!isAdmin(c)) return denied(c);
	const wa = c.req.param('wa');
	if (!WA.test(wa)) return c.json({ error: 'Nomor tidak valid' }, 400);
	try {
		const fs = new Firestore(c.env);
		const all = await fs.all('bookings', 2000);
		const mine = all.filter((b) => String(b.customer?.whatsapp ?? '') === wa);
		if (mine.length === 0) return c.json({ error: 'Pelanggan tidak ditemukan' }, 404);

		const payments = await fs.all('payments', 2000);
		const codes = new Set(mine.map((b) => String(b.bookingCode)));
		const net = netByBooking(payments.filter((p) => codes.has(String(p.bookingId))));
		const now = Date.now();

		mine.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));
		const latest = mine[0];
		const note = await fs.get(`customerNotes/${wa}`);

		let totalSpent = 0;
		for (const v of net.values()) totalSpent += v;

		return c.json({
			whatsapp: wa,
			name: latest.customer?.name ?? '',
			email: latest.customer?.email ?? '',
			address: latest.customer?.address ?? '',
			totalSpent,
			note: note?.note ?? '',
			noteUpdatedAt: note?.updatedAt ?? null,
			bookings: mine.map((b) => ({
				bookingCode: b.bookingCode,
				createdAt: b.createdAt,
				motorTypeName: b.motorTypeName,
				assignedPlate: b.assignedPlate ?? '',
				pickupAt: b.rentalPeriod?.pickupAt,
				returnAt: b.rentalPeriod?.returnAt,
				duration: b.rentalPeriod?.duration,
				total: Number(b.pricing?.total ?? 0),
				paid: net.get(String(b.bookingCode)) ?? 0,
				status: effectiveStatus(b, now),
			})),
		});
	} catch (e) {
		console.error(e);
		return c.json({ error: 'Gagal memuat pelanggan' }, 500);
	}
}

const noteInput = z.object({ note: z.string().trim().max(1000, 'Catatan maksimal 1000 karakter') });

export async function saveNote(c: any) {
	if (!isAdmin(c)) return denied(c);
	const wa = c.req.param('wa');
	if (!WA.test(wa)) return c.json({ error: 'Nomor tidak valid' }, 400);
	const parsed = noteInput.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	}
	try {
		const staff = c.get('staff');
		await new Firestore(c.env).commit([
			{
				path: `customerNotes/${wa}`,
				data: { note: parsed.data.note, updatedAt: new Date(), updatedBy: staff.uid, updatedByEmail: staff.email },
			},
		]);
		return c.json({ ok: true });
	} catch (e) {
		console.error(e);
		return c.json({ error: 'Gagal menyimpan catatan' }, 500);
	}
}
