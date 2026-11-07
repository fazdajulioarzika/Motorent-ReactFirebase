/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from 'hono';
import { Firestore, HttpError, type Env } from './firestore';
import { safeEqual, sha256Hex } from './crypto';
import { destroyPrivate, uploadPrivate } from './cloudinary';
import { looksLikeImage } from './proof';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['pending_payment', 'under_review', 'confirmed'];

export async function handleIdentity(c: Context<{ Bindings: Env }>) {
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
	if (!(file instanceof File)) return c.json({ error: 'Pilih foto KTP/SIM' }, 400);
	if (file.size === 0 || file.size > MAX_BYTES) {
		return c.json({ error: 'Ukuran file harus di bawah 5 MB' }, 400);
	}
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	if (!looksLikeImage(head)) {
		return c.json({ error: 'File harus berupa gambar JPG, PNG, atau WEBP' }, 400);
	}

	const pre = await fs.get(`bookings/${code}`);
	const tokenOk = pre && safeEqual(await sha256Hex(token), String(pre.accessTokenHash));
	if (!pre || !tokenOk) return c.json({ error: 'Booking tidak ditemukan atau token salah' }, 404);
	if (!ALLOWED.includes(pre.bookingStatus)) {
		return c.json({ error: 'Booking ini tidak menerima dokumen lagi' }, 409);
	}

	let publicId: string;
	try {
		publicId = await uploadPrivate(c.env, file, 'motorrent/identity');
	} catch (e) {
		console.error(e);
		return c.json({ error: 'Gagal mengunggah file, coba lagi' }, 500 as never);
	}

	for (let attempt = 0; attempt < 3; attempt++) {
		const tx = await fs.begin();
		try {
			const b = await fs.get(`bookings/${code}`, tx);
			if (!b || !ALLOWED.includes(b.bookingStatus)) {
				await fs.rollback(tx);
				return c.json({ error: 'Booking ini tidak menerima dokumen lagi' }, 409);
			}
			const now = new Date();
			const { id: _id, ...booking } = b;
			await fs.commit(
				[
					{
						path: `bookings/${code}`,
						data: { ...booking, identityReference: publicId, identityUploadedAt: now, updatedAt: now },
					},
				],
				tx
			);
			// Dokumen lama (jika diganti) dihapus dari penyimpanan.
			if (b.identityReference) {
				c.executionCtx.waitUntil(destroyPrivate(c.env, String(b.identityReference)).catch(console.error));
			}
			return c.json({ ok: true });
		} catch (e) {
			if (e instanceof HttpError && e.status === 409) continue;
			await fs.rollback(tx).catch(() => {});
			console.error(e);
			return c.json({ error: 'Gagal menyimpan dokumen, coba lagi' }, 500 as never);
		}
	}
	return c.json({ error: 'Sistem sedang sibuk, coba lagi' }, 409);
}
