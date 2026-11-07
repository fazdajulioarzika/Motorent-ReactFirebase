import { Firestore, type Env } from './firestore';
import { getSettings } from './settings';
export type NotifyEvent = 'created' | 'proof' | 'approved' | 'rejected' | 'reminder_pickup' | 'reminder_return' | 'cancelled';

export interface NotifyInfo {
	bookingCode: string;
	name: string;
	email: string;
	motorName: string;
	pickupAt: Date;
	returnAt: Date;
	total: number;
	amount: number; // nominal yang harus/ telah dibayar
	remaining?: number;
	link?: string;
	reason?: string;
	expiresAt?: Date;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
let BRAND = 'MotoRent';
let APP = '';
const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID');
const when = (d: Date) =>
	new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(d)) + ' WIB';

function layout(title: string, lines: string[], button?: { label: string; url: string }) {
	return `< style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#262626">
<h2 style="color:#F97316;margin-bottom:0">${esc(BRAND)}</h2>
<h3>${esc(title)}</h3>
${lines.map((l) => `<p style="margin:6px 0">${l}</p>`).join('')}
${
	button
		? `<p style="margin:20px 0"><a href="${esc(
				button.url
		  )}" style="background:#F97316;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${esc(button.label)}</a></p>`
		: ''
}
${APP ? `<p style="font-size:12px"><a href="${esc(APP)}/track-booking">Lacak booking Anda</a></p>` : ''}
<p style="color:#737373;font-size:12px">Email otomatis, mohon tidak dibalas.</p></div>`;
}

function build(event: NotifyEvent, i: NotifyInfo): { subject: string; html: string } {
	const sewa = [`Motor: <b>${esc(i.motorName)}</b>`, `Ambil: ${when(i.pickupAt)}`, `Kembali: ${when(i.returnAt)}`];
	const code = esc(i.bookingCode);

	if (event === 'created') {
		return {
			subject: `Booking ${i.bookingCode} diterima`,
			html: layout(
				`Booking ${code} diterima`,
				[
					`Halo ${esc(i.name)}, booking Anda sudah kami terima.`,
					...sewa,
					`Total tagihan: <b>${rp(i.total)}</b>`,
					`Transfer sekarang: <b>${rp(i.amount)}</b>`,
					i.expiresAt ? `Batas pembayaran: ${when(i.expiresAt)}` : '',
				],
				i.link ? { label: 'Bayar & unggah bukti', url: i.link } : undefined
			),
		};
	}
	if (event === 'proof') {
		return {
			subject: `Bukti pembayaran ${i.bookingCode} sedang diperiksa`,
			html: layout('Bukti pembayaran diterima', [
				`Halo ${esc(i.name)}, bukti pembayaran untuk booking <b>${code}</b> sedang diperiksa admin.`,
				'Kami akan mengabari Anda setelah pembayaran disetujui.',
			]),
		};
	}
	if (event === 'approved') {
		return {
			subject: `Booking ${i.bookingCode} terkonfirmasi`,
			html: layout(
				`Booking ${code} terkonfirmasi`,
				[
					`Halo ${esc(i.name)}, pembayaran Anda sudah disetujui.`,
					...sewa,
					`Sudah dibayar: ${rp(i.amount)}`,
					`Sisa dibayar saat pengambilan: <b>${rp(i.remaining ?? 0)}</b>`,
					'Tunjukkan bukti booking dan identitas (KTP/SIM) saat mengambil motor.',
				],
				i.link ? { label: 'Lihat bukti booking', url: i.link } : undefined
			),
		};
	}
	if (event === 'reminder_pickup') {
		return {
			subject: `Pengingat pengambilan motor ${i.bookingCode}`,
			html: layout('Pengingat pengambilan motor', [
				`Halo ${esc(i.name)}, motor Anda siap diambil dalam waktu dekat.`,
				...sewa,
				`Sisa pembayaran saat pengambilan: <b>${rp(i.remaining ?? 0)}</b>`,
				'Bawa KTP/SIM asli dan tunjukkan bukti booking kepada petugas.',
			]),
		};
	}
	if (event === 'reminder_return') {
		return {
			subject: `Pengingat pengembalian motor ${i.bookingCode}`,
			html: layout('Pengingat pengembalian motor', [
				`Halo ${esc(i.name)}, motor <b>${esc(i.motorName)}</b> harus dikembalikan paling lambat <b>${when(i.returnAt)}</b>.`,
				'Keterlambatan melewati batas toleransi dapat dikenakan denda.',
			]),
		};
	}
	if (event === 'cancelled') {
		return {
			subject: `Booking ${i.bookingCode} dibatalkan`,
			html: layout(`Booking ${code} dibatalkan`, [
				`Halo ${esc(i.name)}, booking Anda untuk <b>${esc(i.motorName)}</b> telah dibatalkan.`,
				`Alasan: ${esc(i.reason ?? '-')}`,
				i.amount > 0 ? `Pengembalian dana: <b>${rp(i.amount)}</b>. Admin akan menghubungi Anda untuk proses transfer.` : '',
			]),
		};
	}
	return {
		subject: `Pembayaran ${i.bookingCode} ditolak`,
		html: layout('Pembayaran ditolak', [
			`Halo ${esc(i.name)}, pembayaran untuk booking <b>${code}</b> belum dapat kami setujui.`,
			`Alasan: ${esc(i.reason ?? '-')}`,
			'Silakan unggah bukti yang benar lewat link pembayaran di email pertama kami.',
		]),
	};
}

async function log(env: Env, data: Record<string, unknown>) {
	try {
		await new Firestore(env).commit([{ path: `notifications/${crypto.randomUUID()}`, mustNotExist: true, data }]);
	} catch (e) {
		console.error('log notifikasi gagal', e);
	}
}

/** Tidak pernah melempar error: kegagalan notifikasi tidak boleh membatalkan transaksi. */
export async function notifyBooking(env: Env, event: NotifyEvent, info: NotifyInfo): Promise<void> {
	if (!info.email || !env.RESEND_API_KEY) return;
	const s = await getSettings(env).catch(() => null);
	if (s && !s.notifications.emailEnabled) return;
	BRAND = s?.rental.name || env.RENTAL_NAME || 'MotoRent';
	APP = env.APP_URL || '';
	const { subject, html } = build(event, info);
	let status = 'sent';
	let error = '';
	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: env.EMAIL_FROM, to: [info.email], subject, html }),
		});
		if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
	} catch (e) {
		status = 'failed';
		error = String(e).slice(0, 300);
		console.error(e);
	}
	await log(env, {
		bookingId: info.bookingCode,
		channel: 'email',
		event,
		to: info.email,
		status,
		error,
		createdAt: new Date(),
	});
}
