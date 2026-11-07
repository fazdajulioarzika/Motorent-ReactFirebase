import { sha256Hex } from './crypto';
import type { Env } from './firestore';

export async function uploadPrivate(env: Env, file: File, folder: string): Promise<string> {
	const timestamp = Math.floor(Date.now() / 1000);
	// Parameter diurutkan alfabet, lalu ditambah API secret.
	const toSign = `folder=${folder}&timestamp=${timestamp}&type=authenticated${env.CLOUDINARY_API_SECRET}`;
	const signature = await sha256Hex(toSign);

	const form = new FormData();
	form.append('file', file);
	form.append('api_key', env.CLOUDINARY_API_KEY);
	form.append('timestamp', String(timestamp));
	form.append('signature', signature);
	form.append('signature_algorithm', 'sha256');
	form.append('folder', folder);
	form.append('type', 'authenticated');

	const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
	if (!res.ok) throw new Error(`Cloudinary: ${await res.text()}`);
	const data = (await res.json()) as { public_id: string };
	return data.public_id;
}
/** URL bertanda tangan untuk aset authenticated. Hanya dipakai di dalam Worker. */
export async function signedAuthenticatedUrl(env: Env, publicId: string): Promise<string> {
	const raw = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(publicId + env.CLOUDINARY_API_SECRET));
	let s = '';
	for (const b of new Uint8Array(raw)) s += String.fromCharCode(b);
	const sig = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').slice(0, 8);
	return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/authenticated/s--${sig}--/${publicId}`;
}
export async function uploadPublic(env: Env, file: File, folder: string): Promise<string> {
	const timestamp = Math.floor(Date.now() / 1000);
	const signature = await sha256Hex(`folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`);

	const form = new FormData();
	form.append('file', file);
	form.append('api_key', env.CLOUDINARY_API_KEY);
	form.append('timestamp', String(timestamp));
	form.append('signature', signature);
	form.append('signature_algorithm', 'sha256');
	form.append('folder', folder);

	const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
	if (!res.ok) throw new Error(`Cloudinary: ${await res.text()}`);
	return ((await res.json()) as { public_id: string }).public_id;
}

export function publicImageUrl(env: Env, publicId: string): string {
	return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_800/${publicId}`;
}
export async function destroyPrivate(env: Env, publicId: string): Promise<void> {
	const timestamp = Math.floor(Date.now() / 1000);
	const signature = await sha256Hex(`public_id=${publicId}&timestamp=${timestamp}&type=authenticated${env.CLOUDINARY_API_SECRET}`);
	const form = new FormData();
	form.append('public_id', publicId);
	form.append('type', 'authenticated');
	form.append('api_key', env.CLOUDINARY_API_KEY);
	form.append('timestamp', String(timestamp));
	form.append('signature', signature);
	form.append('signature_algorithm', 'sha256');

	const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`, { method: 'POST', body: form });
	if (!res.ok) throw new Error(`Cloudinary destroy: ${await res.text()}`);
}
