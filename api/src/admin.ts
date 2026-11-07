/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { z } from 'zod';
import { Firestore, HttpError, type Env } from './firestore';
import { requireStaff, type Staff } from './auth';
import { signedAuthenticatedUrl } from './cloudinary';
import { handlePickup, handleReturn, listUnits } from './rentals';
import { notifyBooking } from './notify';
import { randomToken, sha256Hex } from './crypto';
import motors from './motors';
import { handleDashboard } from './dashboard';
import { runCron } from './cron';
import { getSettings, handleGetSettings, handleSaveSettings } from './settings';
import { handleCancel } from './cancel';
import { handleReports } from './reports';
import { customerDetail, listCustomers, saveNote } from './customers';
import { listPayments } from './payments';
import maintenance from './maintenance';

const admin = new Hono<{ Bindings: Env; Variables: { staff: Staff } }>();
admin.use('*', requireStaff);

function publicBooking(b: Record<string, any>) {
	const { accessTokenHash: _h, receiptTokenHashes: _r, identityReference, ...rest } = b;
	return { ...rest, hasIdentity: !!identityReference };
}

admin.get('/bookings', async (c) => {
	const rows = await new Firestore(c.env).list('bookings', 100);
	return c.json(rows.map(publicBooking));
});

admin.get('/bookings/:code', async (c) => {
	const fs = new Firestore(c.env);
	const code = c.req.param('code');
	const b = await fs.get(`bookings/${code}`);
	if (!b) return c.json({ error: 'Booking tidak ditemukan' }, 404);
	const payments = await fs.query('payments', [['bookingId', code]]);
	payments.sort((x, y) => (y.createdAt?.getTime?.() ?? 0) - (x.createdAt?.getTime?.() ?? 0));
	return c.json({ booking: publicBooking(b), payments });
});

// Gambar bukti diteruskan lewat Worker; URL Cloudinary tidak pernah sampai ke browser.
admin.get('/payments/:id/proof', async (c) => {
	const pay = await new Firestore(c.env).get(`payments/${c.req.param('id')}`);
	if (!pay?.proofReference) return c.json({ error: 'Bukti tidak ada' }, 404);
	const url = await signedAuthenticatedUrl(c.env, String(pay.proofReference));
	const upstream = await fetch(url);
	if (!upstream.ok) return c.json({ error: 'Gagal mengambil bukti dari penyimpanan' }, 502 as never);
	return new Response(upstream.body, {
		headers: {
			'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
			'Cache-Control': 'private, no-store',
		},
	});
});

async function decide(c: any, action: 'approve' | 'reject', reason: string): Promise<Response> {
	const fs = new Firestore(c.env);
	const staff = c.get('staff') as Staff;
	const id = c.req.param('id');
	const policy = (await getSettings(c.env, fs)).policy;

	for (let attempt = 0; attempt < 3; attempt++) {
		const tx = await fs.begin();
		try {
			const pay = await fs.get(`payments/${id}`, tx);
			if (!pay) {
				await fs.rollback(tx);
				return c.json({ error: 'Pembayaran tidak ditemukan' }, 404);
			}
			if (pay.status !== 'under_review') {
				await fs.rollback(tx);
				return c.json({ error: 'Pembayaran ini sudah diproses' }, 409);
			}
			const b = await fs.get(`bookings/${pay.bookingId}`, tx);
			if (!b) {
				await fs.rollback(tx);
				return c.json({ error: 'Booking tidak ditemukan' }, 404);
			}

			const now = new Date();
			const { id: _pid, ...payment } = pay;
			const { id: _bid, ...booking } = b;
			const pricing = { ...b.pricing };
			let bookingPatch: Record<string, unknown>;
			let paymentPatch: Record<string, unknown>;
			let receiptToken = '';

			if (action === 'approve') {
				const paid = Number(pricing.paidAmount || 0) + Number(pay.amount);
				pricing.paidAmount = paid;
				pricing.remainingAmount = Math.max(0, Number(pricing.total) - paid);
				receiptToken = randomToken();
				const receiptHash = await sha256Hex(receiptToken);
				bookingPatch = {
					pricing,
					bookingStatus: 'confirmed',
					paymentStatus: paid >= Number(pricing.total) ? 'paid' : 'dp_paid',
					rejectReason: null,
					receiptTokenHashes: [...(b.receiptTokenHashes ?? []), receiptHash],
				};
				paymentPatch = { status: 'approved', verifiedBy: staff.uid, verifiedAt: now };
			} else {
				bookingPatch = {
					bookingStatus: 'pending_payment',
					paymentStatus: 'rejected',
					rejectReason: reason,
					expiresAt: new Date(now.getTime() + policy.paymentExpiryMinutes * 60000),
				};
				paymentPatch = {
					status: 'rejected',
					rejectReason: reason,
					verifiedBy: staff.uid,
					verifiedAt: now,
				};
			}

			await fs.commit(
				[
					{ path: `bookings/${pay.bookingId}`, data: { ...booking, ...bookingPatch, updatedAt: now } },
					{ path: `payments/${id}`, data: { ...payment, ...paymentPatch } },
					{
						path: `bookingLogs/${crypto.randomUUID()}`,
						mustNotExist: true,
						data: {
							bookingId: pay.bookingId,
							action: `payment_${action}`,
							note: reason,
							by: staff.uid,
							byEmail: staff.email,
							createdAt: now,
						},
					},
				],
				tx
			);

			const receiptUrl = receiptToken ? `${c.env.APP_URL}/receipt/${pay.bookingId}?token=${receiptToken}` : null;
			c.executionCtx.waitUntil(
				notifyBooking(c.env, action === 'approve' ? 'approved' : 'rejected', {
					bookingCode: pay.bookingId,
					name: b.customer?.name ?? '',
					email: b.customer?.email ?? '',
					motorName: b.motorTypeName,
					pickupAt: b.rentalPeriod.pickupAt,
					returnAt: b.rentalPeriod.returnAt,
					total: Number(pricing.total),
					amount: Number(pay.amount),
					remaining: Number(pricing.remainingAmount),
					reason,
					link: receiptUrl ?? undefined,
				})
			);
			return c.json({ ok: true, receiptUrl });
		} catch (e) {
			if (e instanceof HttpError && e.status === 409) continue;
			await fs.rollback(tx).catch(() => {});
			console.error(e);
			return c.json({ error: 'Gagal memproses pembayaran' }, 500);
		}
	}
	return c.json({ error: 'Sistem sedang sibuk, coba lagi' }, 409);
}

admin.post('/payments/:id/approve', (c) => decide(c, 'approve', ''));

admin.post('/payments/:id/reject', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = z.object({ reason: z.string().trim().min(3, 'Alasan wajib diisi').max(300) }).safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	return decide(c, 'reject', parsed.data.reason);
});
admin.get('/bookings/:code/units', listUnits);
admin.post('/rentals/pickup', handlePickup);
admin.post('/rentals/return', handleReturn);
admin.post('/bookings/:code/receipt-link', async (c) => {
	const fs = new Firestore(c.env);
	const code = c.req.param('code');
	const tx = await fs.begin();
	try {
		const b = await fs.get(`bookings/${code}`, tx);
		if (!b) {
			await fs.rollback(tx);
			return c.json({ error: 'Booking tidak ditemukan' }, 404);
		}
		if (!['confirmed', 'ongoing', 'completed'].includes(b.bookingStatus)) {
			await fs.rollback(tx);
			return c.json({ error: 'Booking belum terkonfirmasi' }, 409);
		}
		const token = randomToken();
		const hash = await sha256Hex(token);
		const { id: _id, ...booking } = b;
		await fs.commit(
			[
				{
					path: `bookings/${code}`,
					data: {
						...booking,
						receiptTokenHashes: [...(b.receiptTokenHashes ?? []), hash].slice(-5),
						updatedAt: new Date(),
					},
				},
			],
			tx
		);
		return c.json({ receiptUrl: `${c.env.APP_URL}/receipt/${code}?token=${token}` });
	} catch (e) {
		await fs.rollback(tx).catch(() => {});
		console.error(e);
		return c.json({ error: 'Gagal membuat link' }, 500);
	}
});
admin.route('/catalog', motors);
admin.get('/dashboard', handleDashboard);
admin.post('/maintenance/run', async (c) => {
	if (!['super_admin', 'admin'].includes(c.get('staff').role)) {
		return c.json({ error: 'Hanya admin yang boleh menjalankan ini' }, 403);
	}
	return c.json(await runCron(c.env));
});
admin.get('/settings', handleGetSettings);
admin.post('/settings', handleSaveSettings);
admin.post('/bookings/:code/cancel', handleCancel);
admin.get('/reports', handleReports);
admin.get('/customers', listCustomers);
admin.get('/customers/:wa', customerDetail);
admin.post('/customers/:wa/note', saveNote);
admin.get('/payments', listPayments);
admin.route('/maintenance', maintenance);

// Foto KTP/SIM diteruskan lewat Worker dan setiap pembukaan dicatat.
admin.get('/bookings/:code/identity', async (c) => {
	const fs = new Firestore(c.env);
	const code = c.req.param('code');
	const b = await fs.get(`bookings/${code}`);
	if (!b?.identityReference) return c.json({ error: 'Dokumen identitas tidak ada' }, 404);

	const upstream = await fetch(await signedAuthenticatedUrl(c.env, String(b.identityReference)));
	if (!upstream.ok) return c.json({ error: 'Gagal mengambil dokumen' }, 502 as never);

	const staff = c.get('staff');
	c.executionCtx.waitUntil(
		fs
			.commit([
				{
					path: `bookingLogs/${crypto.randomUUID()}`,
					mustNotExist: true,
					data: {
						bookingId: code,
						action: 'view_identity',
						note: '',
						by: staff.uid,
						byEmail: staff.email,
						createdAt: new Date(),
					},
				},
			])
			.catch(console.error)
	);
	return new Response(upstream.body, {
		headers: {
			'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
			'Cache-Control': 'private, no-store',
		},
	});
});
export default admin;
