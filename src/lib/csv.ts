type Cell = string | number | null | undefined;

function cell(v: Cell): string {
  if (typeof v === "number") return String(v);
  let s = String(v ?? "");
  // Cegah sel diperlakukan sebagai rumus oleh Excel.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Pemisah titik koma + BOM agar terbuka rapi di Excel berbahasa Indonesia. */
export function downloadCsv(filename: string, rows: Cell[][]) {
  const text = "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
