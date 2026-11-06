import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminGet, adminPost, adminUpload } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/admin/Pagination";

export interface AdminMotorType {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  description?: string;
  dailyPrice: number;
  specifications: Record<string, string>;
  images: string[];
  isActive: boolean;
}

const CATEGORIES = ["scooter", "matic", "sport", "bebek", "trail"];

const specsToText = (s: Record<string, string>) =>
  Object.entries(s)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

function textToSpecs(t: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of t.split("\n")) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

function TypeForm({
  motor,
  onDone,
}: {
  motor: AdminMotorType | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(motor?.name ?? "");
  const [brand, setBrand] = useState(motor?.brand ?? "");
  const [category, setCategory] = useState(motor?.category ?? "scooter");
  const [price, setPrice] = useState(String(motor?.dailyPrice ?? ""));
  const [desc, setDesc] = useState(motor?.description ?? "");
  const [specs, setSpecs] = useState(specsToText(motor?.specifications ?? {}));
  const [active, setActive] = useState(motor?.isActive ?? true);
  const [images, setImages] = useState<string[]>(motor?.images ?? []);
  const [photoError, setPhotoError] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-types"] });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        brand,
        category,
        description: desc,
        dailyPrice: Number(price),
        specifications: textToSpecs(specs),
        isActive: active,
      };
      return adminPost(
        motor ? `/admin/catalog/types/${motor.slug}` : "/admin/catalog/types",
        body
      );
    },
    onSuccess: () => {
      refresh();
      onDone();
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return adminUpload<{ url: string }>(
        `/admin/catalog/types/${motor!.slug}/images`,
        form
      );
    },
    onSuccess: (r) => {
      setImages((x) => [...x, r.url]);
      setPhotoError("");
      refresh();
    },
    onError: (e: Error) => setPhotoError(e.message),
  });

  const remove = useMutation({
    mutationFn: (url: string) =>
      adminPost(`/admin/catalog/types/${motor!.slug}/images/remove`, { url }),
    onSuccess: (_r, url) => {
      setImages((x) => x.filter((u) => u !== url));
      refresh();
    },
  });

  function onPick(f: File | undefined) {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type))
      return setPhotoError("File harus JPG, PNG, atau WEBP");
    if (f.size > 5 * 1024 * 1024)
      return setPhotoError("Ukuran foto maksimal 5 MB");
    upload.mutate(f);
  }

  return (
    <div className="space-y-4 rounded-xl border bg-white p-5 text-sm">
      <h2 className="text-lg font-semibold">
        {motor ? `Ubah ${motor.name}` : "Tambah tipe motor"}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nama</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Honda Vario 160"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Brand</Label>
          <Input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Honda"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Kategori</Label>
          <select
            className="h-9 w-full rounded-md border bg-white px-3 capitalize"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Harga per hari (Rp)</Label>
          <Input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Deskripsi</Label>
        <Textarea
          rows={2}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Spesifikasi (satu baris, format nama: nilai)</Label>
        <Textarea
          rows={4}
          value={specs}
          onChange={(e) => setSpecs(e.target.value)}
          placeholder={"mesin: 160cc\ntransmisi: Otomatis"}
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Tampilkan di website publik
      </label>

      {motor ? (
        <div className="space-y-2">
          <Label>Foto ({images.length}/6)</Label>
          <div className="flex flex-wrap gap-3">
            {images.map((u) => (
              <div key={u} className="relative">
                <img
                  src={u}
                  alt=""
                  className="h-24 w-32 rounded-lg border object-cover"
                />
                <button
                  type="button"
                  aria-label="Hapus foto"
                  className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white"
                  onClick={() => remove.mutate(u)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={upload.isPending || images.length >= 6}
            onChange={(e) => {
              onPick(e.target.files?.[0]);
              e.target.value = "";
            }}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white"
          />
          {upload.isPending && (
            <p className="text-neutral-500">Mengunggah...</p>
          )}
          {photoError && <p className="text-red-600">{photoError}</p>}
          <p className="text-xs text-neutral-500">
            Foto pertama menjadi foto utama di katalog.
          </p>
        </div>
      ) : (
        <p className="rounded-lg bg-neutral-50 p-3 text-neutral-500">
          Foto bisa diunggah setelah tipe motor disimpan.
        </p>
      )}

      {save.isError && (
        <p className="rounded bg-red-50 p-2 text-red-700">
          {(save.error as Error).message}
        </p>
      )}
      <div className="flex gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Menyimpan..." : "Simpan"}
        </Button>
        <Button variant="outline" onClick={onDone}>
          Tutup
        </Button>
      </div>
    </div>
  );
}

export default function MotorTypes() {
  const [editing, setEditing] = useState<AdminMotorType | "new" | null>(null);
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-types"],
    queryFn: () => adminGet<AdminMotorType[]>("/admin/catalog/types"),
  });
  const pg = usePagination(data, 9);
  if (editing) {
    return (
      <div className="max-w-3xl">
        <TypeForm
          key={editing === "new" ? "new" : editing.slug}
          motor={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tipe Motor</h1>
        <Button onClick={() => setEditing("new")}>Tambah tipe</Button>
      </div>
      {isLoading && <p className="text-neutral-500">Memuat...</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pg.items.map((m) => (
          <button
            key={m.id}
            onClick={() => setEditing(m)}
            className="overflow-hidden rounded-xl border bg-white text-left text-sm transition hover:border-primary hover:shadow-md"
          >
            <div className="flex aspect-[4/3] items-center justify-center bg-neutral-100">
              {m.images?.[0] ? (
                <img
                  src={m.images[0]}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Bike className="h-10 w-10 text-neutral-300" />
              )}
            </div>
            <div className="space-y-1 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{m.name}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    m.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {m.isActive ? "Tampil" : "Disembunyikan"}
                </span>
              </div>
              <p className="capitalize text-neutral-500">
                {m.brand} · {m.category}
              </p>
              <p className="font-bold text-primary">
                {formatRupiah(m.dailyPrice)}
                <span className="text-xs font-normal text-neutral-500">
                  {" "}
                  / hari
                </span>
              </p>
            </div>
          </button>
        ))}
        {!isLoading && data.length === 0 && (
          <p className="text-neutral-500">Belum ada tipe motor.</p>
        )}
      </div>
      <Pagination {...pg.props} sizes={[9, 18, 36]} />
    </div>
  );
}
