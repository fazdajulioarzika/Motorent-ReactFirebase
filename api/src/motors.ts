/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { z } from 'zod';
import { Firestore, HttpError, type Env } from './firestore';
import type { Staff } from './auth';
import { publicImageUrl, uploadPublic } from './cloudinary';
import { looksLikeImage } from './proof';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 6;

class Bad extends Error {
	constructor(public status: number, message: string) {
		super(message);
	}
}

const motors = new Hono<{ Bindings: Env; Variables: { staff: Staff } }>();

// Staff boleh membaca, tetapi hanya admin yang boleh mengubah data master.
motors.use('*', async (c, next) => {
	if (c.req.method !== 'GET' && !['super_admin', 'admin'].includes(c.get('staff').role)) {
		return c.json({ error: 'Hanya admin yang boleh mengubah data ini' }, 403);
	}
	await next();
});

const slugify = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

function fail(c: any, e: unknown) {
	if (e instanceof Bad) return c.json({ error: e.message }, e.status);
	console.error(e);
	return c.json({ error: 'Gagal memproses, coba lagi' }, 500);
}

async function modify(fs: Firestore, path: string, fn: (cur: Record<string, any>) => Record<string, any>): Promise<void> {
	for (let i = 0; i < 3; i++) {
		const tx = await fs.begin();
		try {
			const cur = await fs.get(path, tx);
			if (!cur) throw new Bad(404, 'Data tidak ditemukan');
			const { id: _id, ...rest } = cur;
			await fs.commit([{ path, data: { ...rest, ...fn(cur), updatedAt: new Date() } }], tx);
			return;
		} catch (e) {
			await fs.rollback(tx).catch(() => {});
			if (e instanceof HttpError && e.status === 409) continue;
			throw e;
		}
	}
	throw new Bad(409, 'Sistem sedang sibuk, coba lagi');
}

/* ---------------- Tipe motor ---------------- */
const typeInput = z.object({
	name: z.string().trim().min(3, 'Nama minimal 3 karakter').max(80),
	brand: z.string().trim().min(2, 'Brand wajib diisi').max(40),
	category: z.enum(['scooter', 'matic', 'sport', 'bebek', 'trail']),
	description: z.string().trim().max(500).default(''),
	dailyPrice: z.number().int().min(10000, 'Harga minimal Rp10.000').max(10_000_000),
	specifications: z.record(z.string().max(40), z.string().max(80)),
	isActive: z.boolean(),
});

motors.get('/types', async (c) => {
	const rows = await new Firestore(c.env).all('motorTypes');
	rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
	return c.json(rows);
});

motors.post('/types', async (c) => {
	const parsed = typeInput.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	const v = parsed.data;
	const slug = slugify(v.name);
	if (!slug) return c.json({ error: 'Nama tidak valid' }, 400);

	const fs = new Firestore(c.env);
	try {
		if (await fs.get(`motorTypes/${slug}`)) throw new Bad(409, 'Sudah ada tipe motor dengan nama tersebut');
		const now = new Date();
		await fs.commit([
			{
				path: `motorTypes/${slug}`,
				mustNotExist: true,
				data: { ...v, slug, images: [], createdAt: now, updatedAt: now },
			},
		]);
		return c.json({ ok: true, slug }, 201);
	} catch (e) {
		return fail(c, e);
	}
});

// Slug tidak bisa diubah karena dipakai sebagai motorTypeId pada unit dan booking.
motors.post('/types/:slug', async (c) => {
	const parsed = typeInput.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	try {
		await modify(new Firestore(c.env), `motorTypes/${c.req.param('slug')}`, () => parsed.data);
		return c.json({ ok: true });
	} catch (e) {
		return fail(c, e);
	}
});

motors.post('/types/:slug/images', async (c) => {
	const slug = c.req.param('slug');
	const fs = new Firestore(c.env);
	try {
		const form = await c.req.formData().catch(() => null);
		const file = form?.get('file');
		if (!(file instanceof File)) throw new Bad(400, 'Pilih file foto');
		if (file.size === 0 || file.size > MAX_BYTES) throw new Bad(400, 'Ukuran foto harus di bawah 5 MB');
		const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
		if (!looksLikeImage(head)) throw new Bad(400, 'File harus berupa gambar JPG, PNG, atau WEBP');

		const cur = await fs.get(`motorTypes/${slug}`);
		if (!cur) throw new Bad(404, 'Tipe motor tidak ditemukan');
		if ((cur.images ?? []).length >= MAX_IMAGES) throw new Bad(400, `Maksimal ${MAX_IMAGES} foto`);

		const url = publicImageUrl(c.env, await uploadPublic(c.env, file, 'motorrent/motors'));
		await modify(fs, `motorTypes/${slug}`, (m) => ({ images: [...(m.images ?? []), url] }));
		return c.json({ ok: true, url });
	} catch (e) {
		return fail(c, e);
	}
});

motors.post('/types/:slug/images/remove', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = z.object({ url: z.string().min(1) }).safeParse(body);
	if (!parsed.success) return c.json({ error: 'Data tidak valid' }, 400);
	try {
		await modify(new Firestore(c.env), `motorTypes/${c.req.param('slug')}`, (m) => ({
			images: (m.images ?? []).filter((u: string) => u !== parsed.data.url),
		}));
		return c.json({ ok: true });
	} catch (e) {
		return fail(c, e);
	}
});

/* ---------------- Unit motor ---------------- */
const unitInput = z.object({
	unitCode: z.string().trim().min(2, 'Kode unit wajib diisi').max(30),
	motorTypeId: z.string().min(1, 'Pilih tipe motor'),
	plateNumber: z.string().trim().min(3, 'Plat wajib diisi').max(15),
	year: z.number().int().min(1990).max(2100),
	status: z.enum(['available', 'maintenance', 'inactive']),
	condition: z.enum(['good', 'fair', 'needs_maintenance']),
});

motors.get('/units', async (c) => {
	const rows = await new Firestore(c.env).all('motorUnits');
	rows.sort((a, b) => String(a.unitCode).localeCompare(String(b.unitCode)));
	return c.json(rows);
});

async function checkUnique(fs: Firestore, v: z.infer<typeof unitInput>, selfId?: string) {
	const units = await fs.all('motorUnits');
	const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase();
	for (const u of units) {
		if (u.id === selfId) continue;
		if (norm(String(u.unitCode)) === norm(v.unitCode)) throw new Bad(409, 'Kode unit sudah dipakai');
		if (norm(String(u.plateNumber)) === norm(v.plateNumber)) throw new Bad(409, 'Nomor plat sudah terdaftar');
	}
}

motors.post('/units', async (c) => {
	const parsed = unitInput.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	const v = parsed.data;
	const fs = new Firestore(c.env);
	try {
		if (!(await fs.get(`motorTypes/${v.motorTypeId}`))) throw new Bad(400, 'Tipe motor tidak ditemukan');
		await checkUnique(fs, v);
		const now = new Date();
		await fs.commit([
			{
				path: `motorUnits/${crypto.randomUUID()}`,
				mustNotExist: true,
				data: { ...v, createdAt: now, updatedAt: now },
			},
		]);
		return c.json({ ok: true }, 201);
	} catch (e) {
		return fail(c, e);
	}
});

motors.post('/units/:id', async (c) => {
	const parsed = unitInput.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	const v = parsed.data;
	const id = c.req.param('id');
	const fs = new Firestore(c.env);
	try {
		if (!(await fs.get(`motorTypes/${v.motorTypeId}`))) throw new Bad(400, 'Tipe motor tidak ditemukan');
		await checkUnique(fs, v, id);
		await modify(fs, `motorUnits/${id}`, (cur) => {
			// Unit yang sedang disewa dikunci; status berubah lewat proses pengembalian.
			if (cur.status === 'rented') {
				if (cur.motorTypeId !== v.motorTypeId) throw new Bad(409, 'Unit sedang disewa, tipe tidak bisa diubah');
				return { unitCode: v.unitCode, plateNumber: v.plateNumber, year: v.year, condition: v.condition };
			}
			return v;
		});
		return c.json({ ok: true });
	} catch (e) {
		return fail(c, e);
	}
});

export default motors;
