import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  sizes?: number[];
}

function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1]);
  const nums = [...set]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
  onPageSize,
  sizes = [10, 20, 50],
}: Props) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col items-center justify-between gap-3 py-3 text-sm sm:flex-row print:hidden">
      <div className="flex items-center gap-3 text-neutral-500">
        <span>
          Menampilkan {from} sampai {to} dari {total}
        </span>
        <select
          className="h-8 rounded-md border bg-white px-2 text-neutral-700"
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          aria-label="Jumlah per halaman"
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s} / halaman
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={btn}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageList(page, totalPages).map((n, i) =>
          n === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-neutral-400">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              aria-current={n === page ? "page" : undefined}
              className={`${btn} ${
                n === page
                  ? "border-primary bg-primary text-white"
                  : "bg-white hover:border-primary"
              }`}
            >
              {n}
            </button>
          )
        )}
        <button
          type="button"
          className={btn}
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
