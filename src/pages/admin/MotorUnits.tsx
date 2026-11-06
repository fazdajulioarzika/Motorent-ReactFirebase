import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminGet, adminPost } from "@/lib/api";
import type { AdminMotorType } from "@/pages/admin/MotorTypes";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/admin/Pagination";

interface AdminUnit {
  id: string;
  unitCode: string;
  motorTypeId: string;
  plateNumber: string;
  year: number;
  status: string;
  condition: string;
}

const STATUS: Record<string, { text: string; cls: string }> = {
  available: { text: "Tersedia", cls: "bg-green-100 text-green-800" },
  rented: { text: "Disewa", cls: "bg-purple-100 text-purple-800" },
  maintenance: { text: "Perawatan", cls: "bg-yellow-100 text-yellow-800" },
  inactive: { text: "Nonaktif", cls: "bg-neutral-200 text-neutral-600" },
};
const CONDITION: Record<string, string> = {
  good: "Baik",
  fair: "Cukup",
  needs_maintenance: "Perlu perawatan",
};

function UnitForm({
  unit,
  types,
  onDone,
}: {
  unit: AdminUnit | null;
  types: AdminMotorType[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [unitCode, setUnitCode] = useState(unit?.unitCode ?? "");
  const [typeId, setTypeId] = useState(unit?.motorTypeId ?? "");
  const [plate, setPlate] = useState(unit?.plateNumber ?? "");
  const [year, setYear] = useState(
    String(unit?.year ?? new Date().getFullYear())
  );
  const [status, setStatus] = useState(
    unit?.status === "rented" ? "available" : unit?.status ?? "available"
  );
  const [condition, setCondition] = useState(unit?.condition ?? "good");
  const rented = unit?.status === "rented";

  const save = useMutation({
    mutationFn: () =>
      adminPost(
        unit ? `/admin/catalog/units/${unit.id}` : "/admin/catalog/units",
        {
          unitCode,
          motorTypeId: typeId,
          plateNumber: plate,
          year: Number(year),
          status,
          condition,
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-units"] });
      onDone();
    },
  });

  const sel =
    "h-9 w-full rounded-md border bg-white px-3 disabled:bg-neutral-100";

  return (
    <div className="space-y-4 rounded-xl border bg-white p-5 text-sm">
      <h2 className="text-lg font-semibold">
        {unit ? `Ubah ${unit.unitCode}` : "Tambah unit"}
      </h2>
      {rented && (
        <p className="rounded-lg bg-purple-50 p-3 text-purple-800">
          Unit sedang disewa. Statusnya berubah otomatis saat motor
          dikembalikan.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Kode unit</Label>
          <Input
            value={unitCode}
            onChange={(e) => setUnitCode(e.target.value)}
            placeholder="UNIT-009"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tipe motor</Label>
          <select
            className={sel}
            value={typeId}
            disabled={rented}
            onChange={(e) => setTypeId(e.target.value)}
          >
            <option value="">Pilih tipe...</option>
            {types.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Nomor plat</Label>
          <Input
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="G 1234 XX"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tahun</Label>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <select
            className={sel}
            value={rented ? "rented" : status}
            disabled={rented}
            onChange={(e) => setStatus(e.target.value)}
          >
            {rented && <option value="rented">Disewa</option>}
            <option value="available">Tersedia</option>
            <option value="maintenance">Perawatan</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Kondisi</Label>
          <select
            className={sel}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          >
            {Object.entries(CONDITION).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
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

export default function MotorUnits() {
  const [editing, setEditing] = useState<AdminUnit | "new" | null>(null);
  const [filter, setFilter] = useState("all");

  const units = useQuery({
    queryKey: ["admin-units"],
    queryFn: () => adminGet<AdminUnit[]>("/admin/catalog/units"),
  });
  const types = useQuery({
    queryKey: ["admin-types"],
    queryFn: () => adminGet<AdminMotorType[]>("/admin/catalog/types"),
  });
  const typeName = (id: string) =>
    types.data?.find((t) => t.slug === id)?.name ?? id;
  const rows = (units.data ?? []).filter(
    (u) => filter === "all" || u.motorTypeId === filter
  );
  const pg = usePagination(rows, 10, filter);
  if (editing) {
    return (
      <div className="max-w-3xl">
        <UnitForm
          key={editing === "new" ? "new" : editing.id}
          unit={editing === "new" ? null : editing}
          types={types.data ?? []}
          onDone={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Unit Motor</h1>
        <Button onClick={() => setEditing("new")}>Tambah unit</Button>
      </div>
      <select
        className="h-9 rounded-md border bg-white px-3 text-sm"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="all">Semua tipe</option>
        {(types.data ?? []).map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name}
          </option>
        ))}
      </select>

      {units.isLoading && <p className="text-neutral-500">Memuat...</p>}
      {units.error && (
        <p className="text-red-600">{(units.error as Error).message}</p>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="p-3">Kode</th>
              <th className="p-3">Tipe</th>
              <th className="p-3">Plat</th>
              <th className="p-3">Tahun</th>
              <th className="p-3">Kondisi</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pg.items.map((u) => (
              <tr
                key={u.id}
                className="cursor-pointer border-t hover:bg-neutral-50"
                onClick={() => setEditing(u)}
              >
                <td className="p-3 font-medium text-primary">{u.unitCode}</td>
                <td className="p-3">{typeName(u.motorTypeId)}</td>
                <td className="p-3">{u.plateNumber}</td>
                <td className="p-3">{u.year}</td>
                <td className="p-3">{CONDITION[u.condition] ?? u.condition}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      STATUS[u.status]?.cls ?? "bg-neutral-100"
                    }`}
                  >
                    {STATUS[u.status]?.text ?? u.status}
                  </span>
                </td>
              </tr>
            ))}
            {!units.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-neutral-500">
                  Belum ada unit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...pg.props} />
    </div>
  );
}
