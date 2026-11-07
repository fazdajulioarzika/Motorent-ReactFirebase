/* eslint-disable @typescript-eslint/no-explicit-any */
import { Firestore, HttpError, type Env, type Write } from './firestore';
import { notifyBooking, type NotifyInfo } from './notify';
import { getSettings } from './settings';
import { destroyPrivate } from './cloudinary';

const HOUR = 3600 * 1000;
const PICKUP_WINDOW = 24 * HOUR;
const RETURN_WINDOW = 3 * HOUR;
const MAX_PER_RUN = 50;

/** Ubah satu booking dalam transaksi. Mengembalikan data lama, atau null jika syarat tidak terpenuhi. */
async function mutate(
	fs: Firestore,
	code: string,
	check: (b: Record<string, any>) => boolean,
	patch: (b: Record<string, any>, now: Date) => Record<string, unknown>,
	log?: (now: Date) => Record<string, unknown>
): Promise<Record<string, any> | null> {
	for (let i = 0; i < 3; i++) {
		const tx = await fs.begin();
		try {
			const b = await fs.get(`bookings/${code}`, tx);
			if (!b || !check(b)) {
				await fs.rollback(tx);
				return null;
			}
			const now = new Date();
			const { id: _id, ...booking } = b;
			const writes: Write[] = [{ path: `bookings/${code}`, data: { ...booking, ...patch(b, now), updatedAt: now } }];
			if (log) {
				writes.push({ path: `bookingLogs/${crypto.randomUUID()}`, mustNotExist: true, data: log(now) });
			}
			await fs.commit(writes, tx);
			return b;
		} catch (e) {
			await fs.rollback(tx).catch(() => {});
			if (e instanceof HttpError && e.status === 409) continue;
			throw e;
		}
	}
	return null;
}

async function expireBookings(fs: Firestore, nowMs: number): Promise<number> {
	const rows = await fs.query('bookings', [['bookingStatus', 'pending_payment']]);
	const due = rows.filter((r) => r.expiresAt instanceof Date && r.expiresAt.getTime() <= nowMs).slice(0, MAX_PER_RUN);

	let n = 0;
	for (const r of due) {
		const done = await mutate(
			fs,
			r.id,
			(b) => b.bookingStatus === 'pending_payment' && b.expiresAt instanceof Date && b.expiresAt.getTime() <= Date.now(),
			() => ({ bookingStatus: 'expired', paymentStatus: 'expired' }),
			(now) => ({
				bookingId: r.id,
				action: 'expired',
				note: 'Batas waktu pembayaran lewat',
				by: 'system',
				byEmail: '',
				createdAt: now,
			})
		);
		if (done) n++;
	}
	return n;
}

function infoFrom(b: Record<string, any>): NotifyInfo {
	return {
		bookingCode: b.bookingCode,
		name: b.customer?.name ?? '',
		email: b.customer?.email ?? '',
		motorName: b.motorTypeName,
		pickupAt: b.rentalPeriod.pickupAt,
		returnAt: b.rentalPeriod.returnAt,
		total: Number(b.pricing?.total ?? 0),
		amount: Number(b.pricing?.paidAmount ?? 0),
		remaining: Number(b.pricing?.remainingAmount ?? 0),
	};
}

async function sendReminders(env: Env, fs: Firestore, nowMs: number) {
	let pickup = 0;
	let ret = 0;

	const confirmed = await fs.query('bookings', [['bookingStatus', 'confirmed']]);
	const pickupDue = confirmed
		.filter((r) => {
			const t = r.rentalPeriod?.pickupAt;
			const diff = t instanceof Date ? t.getTime() - nowMs : -1;
			return diff > 0 && diff <= PICKUP_WINDOW && !r.reminders?.pickup;
		})
		.slice(0, MAX_PER_RUN);

	for (const r of pickupDue) {
		// Flag disimpan lebih dulu agar email tidak terkirim ganda.
		const b = await mutate(
			fs,
			r.id,
			(x) => x.bookingStatus === 'confirmed' && !x.reminders?.pickup,
			(x, now) => ({ reminders: { ...(x.reminders ?? {}), pickup: now } })
		);
		if (!b) continue;
		pickup++;
		await notifyBooking(env, 'reminder_pickup', infoFrom(b));
	}

	const ongoing = await fs.query('bookings', [['bookingStatus', 'ongoing']]);
	const returnDue = ongoing
		.filter((r) => {
			const t = r.rentalPeriod?.returnAt;
			const diff = t instanceof Date ? t.getTime() - nowMs : -1;
			return diff > 0 && diff <= RETURN_WINDOW && !r.reminders?.return;
		})
		.slice(0, MAX_PER_RUN);

	for (const r of returnDue) {
		const b = await mutate(
			fs,
			r.id,
			(x) => x.bookingStatus === 'ongoing' && !x.reminders?.return,
			(x, now) => ({ reminders: { ...(x.reminders ?? {}), return: now } })
		);
		if (!b) continue;
		ret++;
		await notifyBooking(env, 'reminder_return', infoFrom(b));
	}

	return { pickup, ret };
}
const RETENTION_DAYS = 30;

async function purgeIdentity(env: Env, fs: Firestore, nowMs: number): Promise<number> {
	let n = 0;
	for (const status of ['completed', 'cancelled', 'expired']) {
		if (n >= 20) break;
		const rows = await fs.query('bookings', [['bookingStatus', status]]);
		const due = rows
			.filter((r) => {
				if (!r.identityReference) return false;
				const ref = [r.returnedAt, r.cancellation?.at, r.updatedAt].find((d) => d instanceof Date) as Date | undefined;
				return !!ref && nowMs - ref.getTime() > RETENTION_DAYS * 24 * HOUR;
			})
			.slice(0, 20 - n);

		for (const r of due) {
			try {
				await destroyPrivate(env, String(r.identityReference));
			} catch (e) {
				console.error('hapus identitas gagal', e);
				continue;
			}
			const done = await mutate(
				fs,
				r.id,
				(b) => !!b.identityReference,
				(_b, now) => ({ identityReference: null, identityDeletedAt: now }),
				(now) => ({
					bookingId: r.id,
					action: 'identity_purged',
					note: `Dihapus otomatis setelah ${RETENTION_DAYS} hari`,
					by: 'system',
					byEmail: '',
					createdAt: now,
				})
			);
			if (done) n++;
		}
	}
	return n;
}

export async function runCron(env: Env) {
	const fs = new Firestore(env);
	const now = Date.now();
	const result = { expired: 0, pickupReminders: 0, returnReminders: 0, identityPurged: 0 };

	try {
		result.expired = await expireBookings(fs, now);
	} catch (e) {
		console.error('cron expire gagal', e);
	}

	const s = await getSettings(env, fs).catch(() => null);
	if (env.REMINDERS_ENABLED !== 'false' && s?.notifications.remindersEnabled !== false) {
		try {
			const r = await sendReminders(env, fs, now);
			result.pickupReminders = r.pickup;
			result.returnReminders = r.ret;
		} catch (e) {
			console.error('cron reminder gagal', e);
		}
	}
	try {
		result.identityPurged = await purgeIdentity(env, fs, now);
	} catch (e) {
		console.error('cron purge gagal', e);
	}
	console.log('cron selesai', JSON.stringify(result));
	return result;
}
