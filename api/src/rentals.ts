/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { Firestore, HttpError } from './firestore';
import type { Staff } from './auth';

class Reject extends Error {
	constructor(public status: number, message: string) {
		super(message);
	}
}

async function withTx(fs: Firestore, fn: (tx: string) => Promise<void>) {
	for (let i = 0; i < 3; i++) {
		const tx = await fs.begin();
		try {
			await fn(tx);
			return;
		} catch (e) {
			await fs.rollback(tx).catch(() => {});
			if (e instanceof HttpError && e.status === 409) continue;
			throw e;
		}
	}
	throw new Reject(409, 'Sistem sedang sibuk, coba lagi');
}

function fail(c: any, e: unknown) {
	if (e instanceof Reject) return c.json({ error: e.message }, e.status);
	console.error(e);
	return c.json({ error: 'Gagal memproses, coba lagi' }, 500);
}

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

/* ---------- daftar unit yang bisa ditetapkan ---------- */
export async function listUnits(c: any) {
	const fs = new Firestore(c.env);
	const b = await fs.get(`bookings/${c.req.param('code')}`);
	if (!b) return c.json({ error: 'Booking tidak ditemukan' }, 404);
	const units = await fs.query('motorUnits', [
		['motorTypeId', b.motorTypeId],
		['status', 'available'],
	]);
	return c.json(
		units.map((u) => ({
			id: u.id,
			unitCode: u.unitCode,
			plateNumber: u.plateNumber,
			condition: u.condition,
			year: u.year,
		}))
	);
}

/* ---------- pickup ---------- */
const pickupInput = z.object({
	bookingCode: z.string().min(1),
	unitId: z.string().min(1, 'Pilih unit motor'),
	initialOdometer: z.number().int().min(0, 'Odometer tidak valid').max(999999),
	conditionNotes: z.string().trim().max(500).default(''),
	idVerified: z.boolean().refine((v) => v, 'Identitas penyewa harus diverifikasi'),
	remainingCollected: z.boolean(),
});

export async function handlePickup(c: any) {
	const staff = c.get('staff') as Staff;
	const parsed = pickupInput.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	}
	const v = parsed.data;
	const fs = new Firestore(c.env);

	try {
		await withTx(fs, async (tx) => {
			const b = await fs.get(`bookings/${v.bookingCode}`, tx);
			if (!b) throw new Reject(404, 'Booking tidak ditemukan');
			if (b.bookingStatus !== 'confirmed') {
				throw new Reject(409, 'Booking belum terkonfirmasi atau sudah diproses');
			}
			const unit = await fs.get(`motorUnits/${v.unitId}`, tx);
			if (!unit || unit.motorTypeId !== b.motorTypeId) {
				throw new Reject(400, 'Unit tidak sesuai tipe motor yang dipesan');
			}
			if (unit.status !== 'available') throw new Reject(409, 'Unit ini sedang tidak tersedia');

			const remaining = Number(b.pricing?.remainingAmount ?? 0);
			if (remaining > 0 && !v.remainingCollected) {
				throw new Reject(400, `Sisa pembayaran ${rupiah(remaining)} harus dilunasi dulu`);
			}

			const now = new Date();
			const { id: _bid, ...booking } = b;
			const { id: _uid, ...unitData } = unit;
			const pricing = { ...b.pricing, paidAmount: Number(b.pricing.total), remainingAmount: 0 };

			const writes: any[] = [
				{
					path: `bookings/${v.bookingCode}`,
					data: {
						...booking,
						pricing,
						bookingStatus: 'ongoing',
						paymentStatus: 'paid',
						assignedUnitId: v.unitId,
						assignedUnitCode: unit.unitCode,
						assignedPlate: unit.plateNumber,
						pickup: {
							actualPickupAt: now,
							initialOdometer: v.initialOdometer,
							conditionNotes: v.conditionNotes,
							idVerified: true,
							by: staff.uid,
						},
						updatedAt: now,
					},
				},
				{ path: `motorUnits/${v.unitId}`, data: { ...unitData, status: 'rented', updatedAt: now } },
				{
					path: `bookingLogs/${crypto.randomUUID()}`,
					mustNotExist: true,
					data: {
						bookingId: v.bookingCode,
						action: 'pickup',
						note: `Unit ${unit.unitCode}, odometer ${v.initialOdometer}`,
						by: staff.uid,
						byEmail: staff.email,
						createdAt: now,
					},
				},
			];
			if (remaining > 0) {
				writes.push({
					path: `payments/${crypto.randomUUID()}`,
					mustNotExist: true,
					data: {
						bookingId: v.bookingCode,
						paymentType: 'remaining',
						amount: remaining,
						method: 'cash_or_transfer_at_pickup',
						status: 'approved',
						verifiedBy: staff.uid,
						verifiedAt: now,
						createdAt: now,
					},
				});
			}
			await fs.commit(writes, tx);
		});
		return c.json({ ok: true });
	} catch (e) {
		return fail(c, e);
	}
}

/* ---------- return ---------- */
const returnInput = z.object({
	bookingCode: z.string().min(1),
	finalOdometer: z.number().int().min(0, 'Odometer tidak valid').max(999999),
	conditionNotes: z.string().trim().max(500).default(''),
	lateFee: z.number().int().min(0).max(100_000_000),
	damageFee: z.number().int().min(0).max(100_000_000),
	feesCollected: z.boolean(),
	unitCondition: z.enum(['good', 'needs_maintenance']),
});

export async function handleReturn(c: any) {
	const staff = c.get('staff') as Staff;
	const parsed = returnInput.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, 400);
	}
	const v = parsed.data;
	const fs = new Firestore(c.env);
	const fees = v.lateFee + v.damageFee;

	try {
		await withTx(fs, async (tx) => {
			const b = await fs.get(`bookings/${v.bookingCode}`, tx);
			if (!b) throw new Reject(404, 'Booking tidak ditemukan');
			if (b.bookingStatus !== 'ongoing') throw new Reject(409, 'Booking ini tidak sedang berjalan');

			const initial = Number(b.pickup?.initialOdometer ?? 0);
			if (v.finalOdometer < initial) {
				throw new Reject(400, `Odometer akhir tidak boleh kurang dari ${initial}`);
			}
			if (fees > 0 && !v.feesCollected) {
				throw new Reject(400, `Denda/biaya ${rupiah(fees)} harus ditagih dulu`);
			}

			const unit = await fs.get(`motorUnits/${b.assignedUnitId}`, tx);
			const now = new Date();
			const lateMinutes = Math.max(0, Math.floor((now.getTime() - (b.rentalPeriod.returnAt as Date).getTime()) / 60000));
			const { id: _bid, ...booking } = b;

			const writes: any[] = [
				{
					path: `bookings/${v.bookingCode}`,
					data: {
						...booking,
						bookingStatus: 'completed',
						extraFees: { lateFee: v.lateFee, damageFee: v.damageFee },
						returnedAt: now,
						updatedAt: now,
					},
				},
				{
					path: `rentalReturns/${v.bookingCode}`,
					mustNotExist: true,
					data: {
						bookingId: v.bookingCode,
						unitId: b.assignedUnitId,
						actualReturnAt: now,
						initialOdometer: initial,
						finalOdometer: v.finalOdometer,
						lateMinutes,
						lateFee: v.lateFee,
						damageFee: v.damageFee,
						depositRefund: 0,
						conditionNotes: v.conditionNotes,
						by: staff.uid,
					},
				},
				{
					path: `bookingLogs/${crypto.randomUUID()}`,
					mustNotExist: true,
					data: {
						bookingId: v.bookingCode,
						action: 'return',
						note: `Odometer ${v.finalOdometer}, denda ${v.lateFee}, kerusakan ${v.damageFee}`,
						by: staff.uid,
						byEmail: staff.email,
						createdAt: now,
					},
				},
			];
			if (unit) {
				const { id: _uid, ...unitData } = unit;
				writes.push({
					path: `motorUnits/${b.assignedUnitId}`,
					data: {
						...unitData,
						status: v.unitCondition === 'good' ? 'available' : 'maintenance',
						condition: v.unitCondition === 'good' ? 'good' : 'needs_maintenance',
						updatedAt: now,
					},
				});
			}
			if (fees > 0) {
				writes.push({
					path: `payments/${crypto.randomUUID()}`,
					mustNotExist: true,
					data: {
						bookingId: v.bookingCode,
						paymentType: 'fee',
						amount: fees,
						method: 'cash_or_transfer_at_return',
						status: 'approved',
						verifiedBy: staff.uid,
						verifiedAt: now,
						createdAt: now,
					},
				});
			}
			await fs.commit(writes, tx);
		});
		return c.json({ ok: true });
	} catch (e) {
		return fail(c, e);
	}
}
