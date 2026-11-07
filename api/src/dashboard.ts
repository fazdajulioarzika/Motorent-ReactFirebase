/* eslint-disable @typescript-eslint/no-explicit-any */
import { Firestore } from './firestore';

const DAY = 24 * 60 * 60 * 1000;
const dayKey = (d: Date) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);

function effectiveStatus(b: Record<string, any>, now: number): string {
	if (b.bookingStatus === 'pending_payment' && b.expiresAt instanceof Date && b.expiresAt.getTime() <= now) {
		return 'expired';
	}
	return String(b.bookingStatus);
}

export async function handleDashboard(c: any) {
	const asked = Number(c.req.query('days'));
	const days = [7, 30, 90].includes(asked) ? asked : 30;

	const fs = new Firestore(c.env);
	const [bookings, units, payments] = await Promise.all([fs.all('bookings'), fs.all('motorUnits'), fs.all('payments')]);
	const now = Date.now();

	// Deret harian untuk rentang yang dipilih.
	const series = new Map<string, { date: string; revenue: number; bookings: number }>();
	for (let i = days - 1; i >= 0; i--) {
		const k = dayKey(new Date(now - i * DAY));
		series.set(k, { date: k, revenue: 0, bookings: 0 });
	}

	let revenue = 0;
	for (const p of payments) {
		if (p.status !== 'approved' || !(p.verifiedAt instanceof Date)) continue;
		const row = series.get(dayKey(p.verifiedAt));
		if (!row) continue;
		const amt = (p.paymentType === 'refund' ? -1 : 1) * Number(p.amount || 0);
		row.revenue += amt;
		revenue += amt;
	}

	const statusCount: Record<string, number> = {};
	const popularity: Record<string, number> = {};
	let inRange = 0;

	for (const b of bookings) {
		if (!(b.createdAt instanceof Date)) continue;
		const row = series.get(dayKey(b.createdAt));
		if (!row) continue;
		row.bookings += 1;
		inRange += 1;
		const st = effectiveStatus(b, now);
		statusCount[st] = (statusCount[st] ?? 0) + 1;
		if (!['expired', 'cancelled'].includes(st)) {
			const name = String(b.motorTypeName ?? '-');
			popularity[name] = (popularity[name] ?? 0) + 1;
		}
	}

	const allEffective = bookings.map((b) => effectiveStatus(b, now));
	const unitCount = (s: string) => units.filter((u) => u.status === s).length;

	const recent = [...bookings]
		.filter((b) => b.createdAt instanceof Date)
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
		.slice(0, 8)
		.map((b) => ({
			bookingCode: b.bookingCode,
			customerName: b.customer?.name,
			motorTypeName: b.motorTypeName,
			total: b.pricing?.total,
			bookingStatus: effectiveStatus(b, now),
			createdAt: b.createdAt,
		}));

	return c.json({
		days,
		cards: {
			totalBookings: inRange,
			waitingPayment: allEffective.filter((s) => s === 'pending_payment').length,
			needsReview: allEffective.filter((s) => s === 'under_review').length,
			confirmed: allEffective.filter((s) => s === 'confirmed').length,
			ongoing: allEffective.filter((s) => s === 'ongoing').length,
			unitsAvailable: unitCount('available'),
			unitsRented: unitCount('rented'),
			unitsMaintenance: unitCount('maintenance'),
			revenue,
		},
		series: [...series.values()],
		statusCount,
		popularity: Object.entries(popularity)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5),
		recent,
	});
}
