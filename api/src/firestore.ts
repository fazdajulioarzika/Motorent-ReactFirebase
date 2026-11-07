/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Env {
	FIREBASE_SERVICE_ACCOUNT: string;
	ALLOWED_ORIGINS: string;
	CLOUDINARY_CLOUD_NAME: string;
	CLOUDINARY_API_KEY: string;
	CLOUDINARY_API_SECRET: string;
	BANK_NAME: string;
	BANK_ACCOUNT: string;
	BANK_HOLDER: string;
	RESEND_API_KEY: string;
	EMAIL_FROM: string;
	APP_URL: string;
	RENTAL_NAME: string;
	RENTAL_ADDRESS: string;
	RENTAL_WHATSAPP: string;
	REMINDERS_ENABLED?: string;
}

export class HttpError extends Error {
	constructor(public status: number, message: string) {
		super(message);
	}
}

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

let cachedToken: { token: string; exp: number } | null = null;

function b64url(input: string | ArrayBuffer): string {
	const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToBuffer(pem: string): ArrayBuffer {
	const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
	const bin = atob(b64);
	const buf = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
	return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

	const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claims = b64url(
		JSON.stringify({
			iss: sa.client_email,
			scope: 'https://www.googleapis.com/auth/datastore',
			aud: 'https://oauth2.googleapis.com/token',
			iat: now,
			exp: now + 3600,
		})
	);
	const key = await crypto.subtle.importKey('pkcs8', pemToBuffer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
		'sign',
	]);
	const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
	const jwt = `${header}.${claims}.${b64url(sig)}`;

	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt,
		}),
	});
	if (!res.ok) throw new HttpError(500, `Gagal mengambil token Google: ${await res.text()}`);
	const data = (await res.json()) as { access_token: string; expires_in: number };
	cachedToken = { token: data.access_token, exp: now + data.expires_in };
	return data.access_token;
}

/* ---------- encode / decode nilai Firestore ---------- */
export function enc(v: unknown): any {
	if (v === null || v === undefined) return { nullValue: null };
	if (v instanceof Date) return { timestampValue: v.toISOString() };
	if (typeof v === 'string') return { stringValue: v };
	if (typeof v === 'boolean') return { booleanValue: v };
	if (typeof v === 'number') {
		return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
	}
	if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
	return { mapValue: { fields: encFields(v as Record<string, unknown>) } };
}

export function encFields(o: Record<string, unknown>): Record<string, any> {
	return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
}

export function dec(v: any): any {
	if ('stringValue' in v) return v.stringValue;
	if ('integerValue' in v) return Number(v.integerValue);
	if ('doubleValue' in v) return v.doubleValue;
	if ('booleanValue' in v) return v.booleanValue;
	if ('timestampValue' in v) return new Date(v.timestampValue);
	if ('nullValue' in v) return null;
	if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(dec);
	if ('mapValue' in v) return decFields(v.mapValue.fields ?? {});
	return null;
}

export function decFields(f: Record<string, any>): Record<string, any> {
	return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, dec(v)]));
}

/* ---------- client ---------- */
export type Write = {
	path: string;
	data: Record<string, unknown>;
	mustNotExist?: boolean;
};

export class Firestore {
	private sa: ServiceAccount;
	private root: string; // projects/x/databases/(default)/documents
	private base: string;

	constructor(env: Env) {
		this.sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
		this.root = `projects/${this.sa.project_id}/databases/(default)/documents`;
		this.base = `https://firestore.googleapis.com/v1/${this.root}`;
	}

	private async call(url: string, method: string, body?: unknown): Promise<any> {
		const token = await getAccessToken(this.sa);
		const res = await fetch(url, {
			method,
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: body ? JSON.stringify(body) : undefined,
		});
		if (res.status === 404) return null;
		if (!res.ok) throw new HttpError(res.status, await res.text());
		return res.json();
	}

	async get(path: string, tx?: string): Promise<Record<string, any> | null> {
		const q = tx ? `?transaction=${encodeURIComponent(tx)}` : '';
		const doc = await this.call(`${this.base}/${path}${q}`, 'GET');
		if (!doc) return null;
		return { id: String(doc.name).split('/').pop(), ...decFields(doc.fields ?? {}) };
	}

	/** Query dengan filter kesamaan (AND). */
	async query(collection: string, equals: [string, unknown][], tx?: string): Promise<Record<string, any>[]> {
		const filters = equals.map(([field, value]) => ({
			fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: enc(value) },
		}));
		const structuredQuery: any = { from: [{ collectionId: collection }] };
		if (filters.length === 1) structuredQuery.where = filters[0];
		if (filters.length > 1) {
			structuredQuery.where = { compositeFilter: { op: 'AND', filters } };
		}
		const rows = await this.call(`${this.base}:runQuery`, 'POST', {
			structuredQuery,
			...(tx ? { transaction: tx } : {}),
		});
		return (rows ?? [])
			.filter((r: any) => r.document)
			.map((r: any) => ({
				id: String(r.document.name).split('/').pop(),
				...decFields(r.document.fields ?? {}),
			}));
	}
	async list(collection: string, max = 100): Promise<Record<string, any>[]> {
		const rows = await this.call(`${this.base}:runQuery`, 'POST', {
			structuredQuery: {
				from: [{ collectionId: collection }],
				orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
				limit: max,
			},
		});
		return (rows ?? [])
			.filter((r: any) => r.document)
			.map((r: any) => ({
				id: String(r.document.name).split('/').pop(),
				...decFields(r.document.fields ?? {}),
			}));
	}
	async all(collection: string, max = 500): Promise<Record<string, any>[]> {
		const rows = await this.call(`${this.base}:runQuery`, 'POST', {
			structuredQuery: { from: [{ collectionId: collection }], limit: max },
		});
		return (rows ?? [])
			.filter((r: any) => r.document)
			.map((r: any) => ({
				id: String(r.document.name).split('/').pop(),
				...decFields(r.document.fields ?? {}),
			}));
	}
	async begin(): Promise<string> {
		const r = await this.call(`${this.base}:beginTransaction`, 'POST', {
			options: { readWrite: {} },
		});
		return r.transaction;
	}

	async commit(writes: Write[], tx?: string): Promise<void> {
		await this.call(`${this.base}:commit`, 'POST', {
			...(tx ? { transaction: tx } : {}),
			writes: writes.map((w) => ({
				update: { name: `${this.root}/${w.path}`, fields: encFields(w.data) },
				...(w.mustNotExist ? { currentDocument: { exists: false } } : {}),
			})),
		});
	}

	async rollback(tx: string): Promise<void> {
		await this.call(`${this.base}:rollback`, 'POST', { transaction: tx });
	}
}
