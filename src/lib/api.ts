import { auth } from "@/lib/firebase";
const API_URL = import.meta.env.VITE_API_URL as string;

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (data as { error?: string }).error ?? "Terjadi kesalahan pada server"
    );
  return data as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse<T>(res);
}

export async function apiGet<T>(path: string): Promise<T> {
  return parse<T>(await fetch(`${API_URL}${path}`));
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return parse<T>(
    await fetch(`${API_URL}${path}`, { method: "POST", body: form })
  );
}
async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error("Belum login");
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

export async function adminGet<T>(path: string): Promise<T> {
  return parse<T>(
    await fetch(`${API_URL}${path}`, { headers: await authHeaders() })
  );
}

export async function adminPost<T>(path: string, body?: unknown): Promise<T> {
  return parse<T>(
    await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    })
  );
}

export async function adminBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Gagal memuat gambar");
  return res.blob();
}
export async function adminUpload<T>(path: string, form: FormData): Promise<T> {
  return parse<T>(
    await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: await authHeaders(),
      body: form,
    })
  );
}
