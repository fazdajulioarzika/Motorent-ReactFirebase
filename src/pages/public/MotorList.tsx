import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import MotorCard from "@/components/motor/MotorCard";
import { apiGet } from "@/lib/api";
import { getActiveMotors } from "@/services/motorService";

export default function MotorList() {
  const [params] = useSearchParams();
  const {
    data: motors = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["motors"],
    queryFn: getActiveMotors,
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const dateOk = from !== "" && to !== "" && from <= to;

  // Konservatif: seluruh hari dihitung, dari 00.00 tanggal ambil sampai 23.59 tanggal kembali (WIB).
  const avail = useQuery({
    queryKey: ["availability", from, to],
    queryFn: () =>
      apiGet<{ types: Record<string, { available: number }> }>(
        `/availability?from=${encodeURIComponent(
          new Date(`${from}T00:00:00+07:00`).toISOString()
        )}&to=${encodeURIComponent(
          new Date(`${to}T23:59:59+07:00`).toISOString()
        )}`
      ),
    enabled: dateOk,
    staleTime: 30_000,
  });
  const types = dateOk ? avail.data?.types : undefined;

  const categories = useMemo(
    () => [...new Set(motors.map((m) => m.category))],
    [motors]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return motors
      .filter((m) => category === "all" || m.category === category)
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.brand.toLowerCase().includes(q)
      )
      .filter(
        (m) => !(onlyAvailable && types) || (types[m.slug]?.available ?? 0) > 0
      )
      .sort((a, b) =>
        sort === "asc"
          ? a.dailyPrice - b.dailyPrice
          : b.dailyPrice - a.dailyPrice
      );
  }, [motors, search, category, sort, onlyAvailable, types]);

  const selectClass = "h-9 rounded-md border bg-white px-3 text-sm";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Daftar Motor</h1>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <Input
          placeholder="Cari nama atau brand..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={selectClass}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Semua kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={sort}
          onChange={(e) => setSort(e.target.value as "asc" | "desc")}
        >
          <option value="asc">Harga termurah</option>
          <option value="desc">Harga termahal</option>
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3 text-sm">
        <div>
          <p className="mb-1 text-xs text-neutral-500">
            Cek ketersediaan: ambil
          </p>
          <Input
            type="date"
            min={today}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-neutral-500">Kembali</p>
          <Input
            type="date"
            min={from || today}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={onlyAvailable}
            disabled={!dateOk}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
          />
          Hanya yang tersedia
        </label>
        {(from || to) && (
          <button
            type="button"
            className="pb-2 text-primary"
            onClick={() => {
              setFrom("");
              setTo("");
              setOnlyAvailable(false);
            }}
          >
            Reset tanggal
          </button>
        )}
        {from && to && from > to && (
          <p className="pb-2 text-red-600">
            Tanggal kembali harus setelah tanggal ambil.
          </p>
        )}
        {avail.isError && (
          <p className="pb-2 text-red-600">Gagal memeriksa ketersediaan.</p>
        )}
      </div>

      {isLoading && <p className="mt-8 text-neutral-500">Memuat...</p>}
      {isError && <p className="mt-8 text-red-600">Gagal memuat data motor.</p>}
      {!isLoading && !isError && filtered.length === 0 && (
        <p className="mt-8 text-neutral-500">Tidak ada motor yang cocok.</p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => (
          <MotorCard
            key={m.id}
            motor={m}
            availability={
              types ? { available: types[m.slug]?.available ?? 0 } : null
            }
          />
        ))}
      </div>
    </div>
  );
}
