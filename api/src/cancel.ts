/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { Firestore, HttpError, type Write } from './firestore';
import type { Staff } from './auth';
import { notifyBooking } from './notify';

const CANCELLABLE = ['pending_payment', 'under_review', 'confirmed'];

const input = z.object({
	reason: z.string().trim().min(3, 'Alasan wajib diisi').max(300),
	refundAmount: z.number().int().min(0).max(100_000_000).default(0),
});

export async function handleCancel(c: any) {
	const staff = c.get('staff') as Staff;
	if (!['super_admin', 'admin'].includes(staff.role)) {
		return c.json({ error: 'Hanya admin yang boleh membatalkan booking' }, 403);
	}
	const parsed = input.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	}
	const { reason, refundAmount } = parsed.data;
	const code = c.req.param('code');
	const fs = new Firestore(c.env);

	for (let attempt = 0; attempt < 3; attempt++) {
		const tx = await fs.begin();
		try {
			const b = await fs.get(`bookings/${code}`, tx);
			if (!b) {
				await fs.rollback(tx);
				return c.json({ error: 'Booking tidak ditemukan' }, 404);
			}
			if (!CANCELLABLE.includes(b.bookingStatus)) {
				await fs.rollback(tx);
				return c.json({ error: 'Booking dengan status ini tidak bisa dibatalkan' }, 409);
			}
			const paid = Number(b.pricing?.paidAmount ?? 0);
			if (refundAmount > paid) {
				await fs.rollback(tx);
				return c.json({ error: 'Refund tidak boleh melebihi jumlah yang sudah dibayar' }, 400);
			}

			const now = new Date();
			const { id: _id, ...booking } = b;
			const pays = await fs.query('payments', [['bookingId', code]], tx);

			const writes: Write[] = [
				{
					path: `bookings/${code}`,
					data: {
						...booking,
						bookingStatus: 'cancelled',
						paymentStatus: refundAmount > 0 ? 'refunded' : 'cancelled',
						cancellation: {
							reason,
							refundAmount,
							by: staff.uid,
							at: now,
						},
						updatedAt: now,
					},
				},
				{
					path: `bookingLogs/${crypto.randomUUID()}`,
					mustNotExist: true,
					data: {
						bookingId: code,
						action: 'cancel',
						note: `${reason} (refund ${refundAmount})`,
						by: staff.uid,
						byEmail: staff.email,
						createdAt: now,
					},
				},
			];

			for (const p of pays) {
				if (p.status !== 'under_review') continue;
				const { id: pid, ...pay } = p;
				writes.push({
					path: `payments/${pid}`,
					data: { ...pay, status: 'cancelled', cancelReason: reason, verifiedBy: staff.uid, verifiedAt: now },
				});
			}

			if (refundAmount > 0) {
				writes.push({
					path: `payments/${crypto.randomUUID()}`,
					mustNotExist: true,
					data: {
						bookingId: code,
						paymentType: 'refund',
						amount: refundAmount,
						method: 'manual_refund',
						status: 'approved',
						note: reason,
						verifiedBy: staff.uid,
						verifiedAt: now,
						createdAt: now,
					},
				});
			}

			await fs.commit(writes, tx);

			c.executionCtx.waitUntil(
				notifyBooking(c.env, 'cancelled', {
					bookingCode: code,
					name: b.customer?.name ?? '',
					email: b.customer?.email ?? '',
					motorName: b.motorTypeName,
					pickupAt: b.rentalPeriod.pickupAt,
					returnAt: b.rentalPeriod.returnAt,
					total: Number(b.pricing?.total ?? 0),
					amount: refundAmount,
					reason,
				})
			);
			return c.json({ ok: true });
		} catch (e) {
			await fs.rollback(tx).catch(() => {});
			if (e instanceof HttpError && e.status === 409) continue;
			console.error(e);
			return c.json({ error: 'Gagal membatalkan booking' }, 500);
		}
	}
	return c.json({ error: 'Sistem sedang sibuk, coba lagi' }, 409);
}
