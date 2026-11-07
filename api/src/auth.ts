/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MiddlewareHandler } from 'hono';
import { Firestore, type Env } from './firestore';

export interface Staff {
	uid: string;
	email: string;
	role: string;
}

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks: { keys: any[]; exp: number } | null = null;

async function getKeys(): Promise<any[]> {
	if (jwks && jwks.exp > Date.now()) return jwks.keys;
	const res = await fetch(JWKS_URL);
	if (!res.ok) throw new Error('Gagal mengambil kunci Firebase');
	const data = (await res.json()) as { keys: any[] };
	jwks = { keys: data.keys, exp: Date.now() + 3600 * 1000 };
	return data.keys;
}

function b64urlToBytes(s: string): Uint8Array {
	const b64 = s
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.padEnd(Math.ceil(s.length / 4) * 4, '=');
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

const parseJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

export async function verifyIdToken(token: string, projectId: string) {
	const parts = token.split('.');
	if (parts.length !== 3) throw new Error('Token tidak valid');
	const header = parseJson(parts[0]);
	const claims = parseJson(parts[1]);
	if (header.alg !== 'RS256') throw new Error('Algoritma token tidak valid');

	const jwk = (await getKeys()).find((k) => k.kid === header.kid);
	if (!jwk) throw new Error('Kunci token tidak dikenal');
	const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
	const valid = await crypto.subtle.verify(
		'RSASSA-PKCS1-v1_5',
		key,
		b64urlToBytes(parts[2]),
		new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
	);
	if (!valid) throw new Error('Tanda tangan token salah');

	const now = Math.floor(Date.now() / 1000);
	if (claims.aud !== projectId) throw new Error('Audience token salah');
	if (claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Issuer token salah');
	if (!claims.sub || claims.exp <= now) throw new Error('Token kedaluwarsa');
	return { uid: claims.sub as string, email: (claims.email as string) ?? '' };
}

const ROLES = ['super_admin', 'admin', 'staff'];

export const requireStaff: MiddlewareHandler<{
	Bindings: Env;
	Variables: { staff: Staff };
}> = async (c, next) => {
	const h = c.req.header('Authorization') ?? '';
	if (!h.startsWith('Bearer ')) return c.json({ error: 'Perlu login' }, 401);
	try {
		const projectId = JSON.parse(c.env.FIREBASE_SERVICE_ACCOUNT).project_id as string;
		const { uid, email } = await verifyIdToken(h.slice(7), projectId);
		// Role dibaca dari Firestore (sumber tepercaya), bukan dari klaim browser.
		const user = await new Firestore(c.env).get(`users/${uid}`);
		if (!user || !ROLES.includes(String(user.role))) {
			return c.json({ error: 'Akun ini tidak punya akses admin' }, 403);
		}
		c.set('staff', { uid, email, role: String(user.role) });
	} catch (e) {
		console.error(e);
		return c.json({ error: 'Token tidak valid' }, 401);
	}
	await next();
};
