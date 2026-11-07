/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from 'hono';
import { Firestore, HttpError, type Env } from './firestore';
import { safeEqual, sha256Hex } from './crypto';
import { uploadPrivate } from './cloudinary';
import { notifyBooking } from './notify';

const MAX_BYTES = 5 * 1024 * 1024;

export function looksLikeImage(b: Uint8Array): boolean {
	const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
	const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
	const webp =
		b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
	return jpeg || png || webp;
}

export async function handleProof(c: Context<{ Bindings: Env }>) {
	const code = c.req.param('code') ?? '';
	const fs = new Firestore(c.env);

	const len = Number(c.req.header('content-length') ?? 0);
	if (len > MAX_BYTES + 100_000) return c.json({ error: 'Ukuran file maksimal 5 MB' }, 413);

	let form: FormData;
	try {
		form = await c.req.formData();
	} catch {
		return c.json({ error: 'Format upload tidak valid' }, 400);
	}
	const token = String(form.get('token') ?? '');
	const file = form.get('file');
	if (!token) return c.json({ error: 'Token wajib diisi' }, 401);
	if (!(file instanceof File)) return c.json({ error: 'Pilih file bukti transfer' }, 400);
	if (file.size === 0 || file.size > MAX_BYTES) {
		return c.json({ error: 'Ukuran file harus di bawah 5 MB' }, 400);
	}
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	if (!looksLikeImage(head)) {
		return c.json({ error: 'File harus berupa gambar JPG, PNG, atau WEBP' }, 400);
	}

	// Cek awal sebelum upload agar file tidak terbuang percuma.
	const pre = await fs.get(`bookings/${code}`);
	const tokenOk = pre && safeEqual(await sha256Hex(token), String(pre.accessTokenHash));
	if (!pre || !tokenOk) return c.json({ error: 'Booking tidak ditemukan atau token salah' }, 404);
	if (pre.bookingStatus !== 'pending_payment') {
		return c.json({ error: 'Booking ini tidak menerima bukti pembayaran lagi' }, 409);
	}
	if (!pre.identityReference) {
		return c.json({ error: 'Unggah foto KTP/SIM terlebih dahulu' }, 400);
	}
	if (pre.expiresAt instanceof Date && pre.expiresAt.getTime() <= Date.now()) {
		return c.json({ error: 'Batas waktu pembayaran sudah lewat. Silakan buat booking baru.' }, 409);
	}

	let publicId: string;
	try {
		publicId = await uploadPrivate(c.env, file, 'motorrent/proofs');
	} catch (e) {
		console.error(e);
		return c.json({ error: 'Gagal mengunggah file, coba lagi' }, 500 as never);
	}

	for (let attempt = 0; attempt < 3; attempt++) {
		const tx = await fs.begin();
		try {
			const b = await fs.get(`bookings/${code}`, tx);
			if (!b || b.bookingStatus !== 'pending_payment') {
				await fs.rollback(tx);
				return c.json({ error: 'Booking ini tidak menerima bukti pembayaran lagi' }, 409);
			}
			const now = new Date();
			const { id: _id, ...booking } = b;
			const paymentId = crypto.randomUUID();

			await fs.commit(
				[
					{
						path: `bookings/${code}`,
						data: {
							...booking,
							bookingStatus: 'under_review',
							paymentStatus: 'under_review',
							updatedAt: now,
						},
					},
					{
						path: `payments/${paymentId}`,
						mustNotExist: true,
						data: {
							bookingId: code,
							paymentType: b.paymentType,
							amount: b.pricing?.requiredPayment ?? 0,
							method: 'bank_transfer',
							proofReference: publicId,
							status: 'under_review',
							verifiedBy: null,
							verifiedAt: null,
							createdAt: now,
						},
					},
				],
				tx
			);
			c.executionCtx.waitUntil(
				notifyBooking(c.env, 'proof', {
					bookingCode: code,
					name: b.customer?.name ?? '',
					email: b.customer?.email ?? '',
					motorName: b.motorTypeName,
					pickupAt: b.rentalPeriod.pickupAt,
					returnAt: b.rentalPeriod.returnAt,
					total: Number(b.pricing?.total ?? 0),
					amount: Number(b.pricing?.requiredPayment ?? 0),
				})
			);
			return c.json({ ok: true, bookingStatus: 'under_review' });
		} catch (e) {
			if (e instanceof HttpError && e.status === 409) continue;
			await fs.rollback(tx).catch(() => {});
			console.error(e);
			return c.json({ error: 'Gagal menyimpan bukti, coba lagi' }, 500 as never);
		}
	}
	return c.json({ error: 'Sistem sedang sibuk, coba lagi' }, 409);
}
