/* eslint-disable @typescript-eslint/no-explicit-any */
import { Firestore } from './firestore';

export async function listPayments(c: any) {
	try {
		const fs = new Firestore(c.env);
		const [payments, bookings] = await Promise.all([fs.all('payments', 2000), fs.all('bookings', 2000)]);
		const byCode = new Map(bookings.map((b) => [String(b.bookingCode), b]));

		const rows = payments
			.map((p) => {
				const b = byCode.get(String(p.bookingId));
				return {
					id: p.id,
					bookingCode: String(p.bookingId ?? ''),
					customerName: b?.customer?.name ?? '-',
					motorTypeName: b?.motorTypeName ?? '-',
					paymentType: String(p.paymentType ?? ''),
					amount: Number(p.amount || 0),
					method: String(p.method ?? ''),
					status: String(p.status ?? ''),
					rejectReason: p.rejectReason ?? null,
					hasProof: !!p.proofReference,
					createdAt: p.createdAt instanceof Date ? p.createdAt : null,
					verifiedAt: p.verifiedAt instanceof Date ? p.verifiedAt : null,
				};
			})
			.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

		return c.json(rows);
	} catch (e) {
		console.error(e);
		return c.json({ error: 'Gagal memuat pembayaran' }, 500);
	}
}
