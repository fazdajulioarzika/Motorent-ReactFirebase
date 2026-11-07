/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { z } from 'zod';
import { Firestore, HttpError, type Env } from './firestore';
import type { Staff } from './auth';

class Bad extends Error {
	constructor(public status: number, message: string) {
		super(message);
	}
}

const maintenance = new Hono<{ Bindings: Env; Variables: { staff: Staff } }>();
const isAdmin = (role: string) => ['super_admin', 'admin'].includes(role);

maintenance.use('*', async (c, next) => {
	if (c.req.method !== 'GET' && !isAdmin(c.get('staff').role)) {
		return c.json({ error: 'Hanya admin yang boleh mengubah data perawatan' }, 403);
	}
	await next();
});

function fail(c: any, e: unknown) {
	if (e instanceof Bad) return c.json({ error: e.message }, e.status);
	console.error(e);
	return c.json({ error: 'Gagal memproses, coba lagi' }, 500);
}

maintenance.get('/', async (c) => {
	try {
		const fs = new Firestore(c.env);
		const [items, units] = await Promise.all([fs.all('maintenance', 500), fs.all('motorUnits', 500)]);
		const byId = new Map(units.map((u) => [u.id, u]));
		const rows = items
			.map((m) => ({
				id: m.id,
				unitId: m.unitId,
				unitCode: byId.get(m.unitId)?.unitCode ?? '-',
				plateNumber: byId.get(m.unitId)?.plateNumber ?? '-',
				description: m.description,
				cost: Number(m.cost ?? 0),
				status: m.status,
				startedAt: m.startedAt ?? null,
				completedAt: m.completedAt ?? null,
			}))
			.sort((a, b) => (b.startedAt?.getTime?.() ?? 0) - (a.startedAt?.getTime?.() ?? 0));
		return c.json({ canEdit: isAdmin(c.get('staff').role), items: rows });
	} catch (e) {
		return fail(c, e);
	}
});

const createInput = z.object({
	unitId: z.string().min(1, 'Pilih unit'),
	description: z.string().trim().min(3, 'Isi keterangan perawatan').max(300),
	cost: z.number().int().min(0).max(100_000_000).default(0),
});

maintenance.post('/', async (c) => {
	const parsed = createInput.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	const v = parsed.data;
	const staff = c.get('staff');
	const fs = new Firestore(c.env);

	try {
		for (let i = 0; i < 3; i++) {
			const tx = await fs.begin();
			try {
				const unit = await fs.get(`motorUnits/${v.unitId}`, tx);
				if (!unit) throw new Bad(404, 'Unit tidak ditemukan');
				if (unit.status === 'rented') throw new Bad(409, 'Unit sedang disewa, tunggu sampai dikembalikan');
				const now = new Date();
				const { id: _id, ...unitData } = unit;
				await fs.commit(
					[
						{
							path: `motorUnits/${v.unitId}`,
							data: { ...unitData, status: 'maintenance', condition: 'needs_maintenance', updatedAt: now },
						},
						{
							path: `maintenance/${crypto.randomUUID()}`,
							mustNotExist: true,
							data: {
								unitId: v.unitId,
								description: v.description,
								cost: v.cost,
								status: 'in_progress',
								startedAt: now,
								completedAt: null,
								createdBy: staff.uid,
							},
						},
					],
					tx
				);
				return c.json({ ok: true }, 201);
			} catch (e) {
				await fs.rollback(tx).catch(() => {});
				if (e instanceof HttpError && e.status === 409) continue;
				throw e;
			}
		}
		throw new Bad(409, 'Sistem sedang sibuk, coba lagi');
	} catch (e) {
		return fail(c, e);
	}
});

const completeInput = z.object({ cost: z.number().int().min(0).max(100_000_000) });

maintenance.post('/:id/complete', async (c) => {
	const parsed = completeInput.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) return c.json({ error: 'Biaya tidak valid' }, 400);
	const id = c.req.param('id');
	const fs = new Firestore(c.env);

	try {
		for (let i = 0; i < 3; i++) {
			const tx = await fs.begin();
			try {
				const m = await fs.get(`maintenance/${id}`, tx);
				if (!m) throw new Bad(404, 'Data perawatan tidak ditemukan');
				if (m.status !== 'in_progress') throw new Bad(409, 'Perawatan ini sudah selesai');

				const others = (await fs.query('maintenance', [['unitId', m.unitId]], tx)).filter((x) => x.id !== id && x.status === 'in_progress');
				const unit = await fs.get(`motorUnits/${m.unitId}`, tx);
				const now = new Date();
				const { id: _mid, ...mData } = m;
				const writes: any[] = [
					{
						path: `maintenance/${id}`,
						data: { ...mData, status: 'done', cost: parsed.data.cost, completedAt: now },
					},
				];
				// Unit baru tersedia lagi jika tidak ada perawatan lain yang berjalan.
				if (unit && unit.status === 'maintenance' && others.length === 0) {
					const { id: _uid, ...uData } = unit;
					writes.push({
						path: `motorUnits/${m.unitId}`,
						data: { ...uData, status: 'available', condition: 'good', updatedAt: now },
					});
				}
				await fs.commit(writes, tx);
				return c.json({ ok: true });
			} catch (e) {
				await fs.rollback(tx).catch(() => {});
				if (e instanceof HttpError && e.status === 409) continue;
				throw e;
			}
		}
		throw new Bad(409, 'Sistem sedang sibuk, coba lagi');
	} catch (e) {
		return fail(c, e);
	}
});

export default maintenance;
