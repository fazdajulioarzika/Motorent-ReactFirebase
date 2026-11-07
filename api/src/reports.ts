/* eslint-disable @typescript-eslint/no-explicit-any */
import { Firestore } from './firestore';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const MAX_RANGE_DAYS = 366;
const GROUPS = ['day', 'week', 'month', 'year'];
const REVENUE_TYPES = ['dp', 'full', 'remaining', 'fee'];

const wib = (d: Date) => new Date(d.getTime() + 7 * HOUR);
const ymd = (d: Date) => wib(d).toISOString().slice(0, 10);

function periodKey(d: Date, group: string): string {
	const s = ymd(d);
	if (group === 'month') return s.slice(0, 7);
	if (group === 'year') return s.slice(0, 4);
	if (group === 'week') {
		const w = wib(d);
		const dow = (w.getUTCDay() + 6) % 7; // Senin = 0
		const monday = new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate() - dow));
		return monday.toISOString().slice(0, 10);
	}
	return s;
}

function effectiveStatus(b: Record<string, any>, now: number): string {
	if (b.bookingStatus === 'pending_payment' && b.expiresAt instanceof Date && b.expiresAt.getTime() <= now) {
		return 'expired';
	}
	return String(b.bookingStatus);
}

export async function handleReports(c: any) {
	if (!['super_admin', 'admin'].includes(c.get('staff').role)) {
		return c.json({ error: 'Hanya admin yang boleh membuka laporan' }, 403);
	}

	const from = c.req.query('from') ?? '';
	const to = c.req.query('to') ?? '';
	const group = GROUPS.includes(c.req.query('group') ?? '') ? (c.req.query('group') as string) : 'day';
	const date = /^\d{4}-\d{2}-\d{2}$/;
	if (!date.test(from) || !date.test(to)) return c.json({ error: 'Format tanggal tidak valid' }, 400);

	const fromMs = Date.parse(`${from}T00:00:00+07:00`);
	const toMs = Date.parse(`${to}T23:59:59.999+07:00`);
	if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
		return c.json({ error: 'Rentang tanggal tidak valid' }, 400);
	}
	if (toMs - fromMs > MAX_RANGE_DAYS * DAY) {
		return c.json({ error: `Rentang maksimal ${MAX_RANGE_DAYS} hari` }, 400);
	}

	try {
		const fs = new Firestore(c.env);
		const [bookings, payments] = await Promise.all([fs.all('bookings', 2000), fs.all('payments', 2000)]);
		const now = Date.now();

		type Row = {
			period: string;
			dp: number;
			full: number;
			remaining: number;
			fee: number;
			refund: number;
			net: number;
			bookings: number;
		};
		const rows = new Map<string, Row>();
		const row = (k: string): Row => {
			let r = rows.get(k);
			if (!r) {
				r = { period: k, dp: 0, full: 0, remaining: 0, fee: 0, refund: 0, net: 0, bookings: 0 };
				rows.set(k, r);
			}
			return r;
		};

		const totals = { dp: 0, full: 0, remaining: 0, fee: 0, gross: 0, refund: 0, net: 0 };
		const transactions: any[] = [];

		for (const p of payments) {
			if (p.status !== 'approved' || !(p.verifiedAt instanceof Date)) continue;
			const t = p.verifiedAt.getTime();
			if (t < fromMs || t > toMs) continue;
			const type = String(p.paymentType);
			const amount = Number(p.amount || 0);
			const r = row(periodKey(p.verifiedAt, group));

			if (type === 'refund') {
				r.refund += amount;
				totals.refund += amount;
			} else if (REVENUE_TYPES.includes(type)) {
				(r as any)[type] += amount;
				(totals as any)[type] += amount;
				totals.gross += amount;
			} else {
				continue;
			}
			transactions.push({
				date: p.verifiedAt,
				bookingCode: p.bookingId,
				type,
				method: p.method ?? '',
				amount,
			});
		}

		const statusCount: Record<string, number> = {};
		const motors = new Map<string, { name: string; count: number; days: number }>();
		const bookingRows: any[] = [];

		for (const b of bookings) {
			if (!(b.createdAt instanceof Date)) continue;
			const t = b.createdAt.getTime();
			if (t < fromMs || t > toMs) continue;

			row(periodKey(b.createdAt, group)).bookings += 1;
			const st = effectiveStatus(b, now);
			statusCount[st] = (statusCount[st] ?? 0) + 1;

			if (['confirmed', 'ongoing', 'completed'].includes(st)) {
				const name = String(b.motorTypeName ?? '-');
				const m = motors.get(name) ?? { name, count: 0, days: 0 };
				m.count += 1;
				m.days += Number(b.rentalPeriod?.duration ?? 0);
				motors.set(name, m);
			}

			bookingRows.push({
				bookingCode: b.bookingCode,
				createdAt: b.createdAt,
				customerName: b.customer?.name ?? '',
				whatsapp: b.customer?.whatsapp ?? '',
				motorTypeName: b.motorTypeName,
				assignedPlate: b.assignedPlate ?? '',
				pickupAt: b.rentalPeriod?.pickupAt,
				returnAt: b.rentalPeriod?.returnAt,
				duration: b.rentalPeriod?.duration,
				paymentType: b.paymentType,
				total: Number(b.pricing?.total ?? 0),
				paid: Number(b.pricing?.paidAmount ?? 0),
				remaining: Number(b.pricing?.remainingAmount ?? 0),
				status: st,
			});
		}

		for (const r of rows.values()) {
			r.net = r.dp + r.full + r.remaining + r.fee - r.refund;
		}
		totals.net = totals.gross - totals.refund;

		// Posisi hari ini, tidak mengikuti rentang tanggal.
		const pendingReview = payments.filter((p) => p.status === 'under_review').reduce((s, p) => s + Number(p.amount || 0), 0);
		const outstanding = bookings
			.filter((b) => ['confirmed', 'ongoing'].includes(String(b.bookingStatus)))
			.reduce((s, b) => s + Number(b.pricing?.remainingAmount ?? 0), 0);
		const waitingPayment = bookings.filter((b) => effectiveStatus(b, now) === 'pending_payment').length;

		return c.json({
			from,
			to,
			group,
			totals,
			rows: [...rows.values()].sort((a, b) => a.period.localeCompare(b.period)),
			bookingCount: bookingRows.length,
			statusCount,
			motors: [...motors.values()].sort((a, b) => b.count - a.count),
			pending: { pendingReview, outstanding, waitingPayment },
			transactions: transactions.sort((a, b) => b.date.getTime() - a.date.getTime()),
			bookings: bookingRows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
		});
	} catch (e) {
		console.error(e);
		return c.json({ error: 'Gagal membuat laporan' }, 500);
	}
}
