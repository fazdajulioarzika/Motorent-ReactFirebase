import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Pagination from "@/components/admin/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { adminGet, adminPost } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { fmtDate } from "@/pages/admin/Bookings";

interface Item {
  id: string;
  unitId: string;
  unitCode: string;
  plateNumber: string;
  description: string;
  cost: number;
  status: "in_progress" | "done";
  startedAt: string | null;
  completedAt: string | null;
}
interface UnitLite {
  id: string;
  unitCode: string;
  plateNumber: string;
  status: string;
}

export default function Maintenance() {
  const qc = useQueryClient();
  const [unitId, setUnitId] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("0");
  const [filter, setFilter] = useState("all");

  const list = useQuery({
    queryKey: ["admin-maintenance"],
    queryFn: () =>
      adminGet<{ canEdit: boolean; items: Item[] }>("/admin/maintenance"),
  });
  const units = useQuery({
    queryKey: ["admin-units"],
    queryFn: () => adminGet<UnitLite[]>("/admin/catalog/units"),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-maintenance"] });
    qc.invalidateQueries({ queryKey: ["admin-units"] });
  };
  const create = useMutation({
    mutationFn: () =>
      adminPost("/admin/maintenance", {
        unitId,
        description,
        cost: Number(cost) || 0,
      }),
    onSuccess: () => {
      setUnitId("");
      setDescription("");
      setCost("0");
      refresh();
    },
  });
  const complete = useMutation({
    mutationFn: (v: { id: string; cost: number }) =>
      adminPost(`/admin/maintenance/${v.id}/complete`, { cost: v.cost }),
    onSuccess: refresh,
  });

  const items = (list.data?.items ?? []).filter(
    (i) => filter === "all" || i.status === filter
  );
  const pg = usePagination(items, 10, filter);
  const canEdit = list.data?.canEdit ?? false;
  const choices = (units.data ?? []).filter((u) => u.status !== "rented");
  const error = (create.error ?? complete.error) as Error | null;

  function finish(i: Item) {
    const input = window.prompt("Biaya perawatan akhir (Rp)", String(i.cost));
    if (input === null) return;
    const value = Number(input.replace(/\D/g, ""));
    complete.mutate({ id: i.id, cost: value });
  }

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">Perawatan Unit</h1>

      {canEdit && (
        <section className="space-y-4 rounded-xl border bg-white p-5 text-sm">
          <h2 className="font-semibold">Catat perawatan baru</h2>
          <p className="text-neutral-500">
            Unit otomatis keluar dari stok sampai perawatan diselesaikan.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <select
                className="h-9 w-full rounded-md border bg-white px-3"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                <option value="">Pilih unit...</option>
                {choices.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitCode} · {u.plateNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Keterangan</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ganti oli dan rem belakang"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perkiraan biaya (Rp)</Label>
              <Input
                type="number"
                min={0}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
          </div>
          <Button
            disabled={
              !unitId || description.trim().length < 3 || create.isPending
            }
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Menyimpan..." : "Mulai perawatan"}
          </Button>
        </section>
      )}
      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">
          {error.message}
        </p>
      )}

      <select
        className="h-9 rounded-md border bg-white px-3 text-sm"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="all">Semua status</option>
        <option value="in_progress">Sedang berjalan</option>
        <option value="done">Selesai</option>
      </select>

      {list.isLoading && <p className="text-neutral-500">Memuat...</p>}
      {list.error && (
        <p className="text-red-600">{(list.error as Error).message}</p>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="p-3">Unit</th>
              <th className="p-3">Keterangan</th>
              <th className="p-3">Mulai</th>
              <th className="p-3">Selesai</th>
              <th className="p-3">Biaya</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {pg.items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-3 font-medium">
                  {i.unitCode}
                  <span className="block text-xs font-normal text-neutral-500">
                    {i.plateNumber}
                  </span>
                </td>
                <td className="p-3">{i.description}</td>
                <td className="p-3">
                  {i.startedAt ? fmtDate(i.startedAt) : "-"}
                </td>
                <td className="p-3">
                  {i.completedAt ? fmtDate(i.completedAt) : "-"}
                </td>
                <td className="p-3">{formatRupiah(i.cost)}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      i.status === "done"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {i.status === "done" ? "Selesai" : "Berjalan"}
                  </span>
                </td>
                <td className="p-3">
                  {canEdit && i.status === "in_progress" && (
                    <button
                      className="text-primary"
                      disabled={complete.isPending}
                      onClick={() => finish(i)}
                    >
                      Selesaikan
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!list.isLoading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-neutral-500">
                  Belum ada catatan perawatan.
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
