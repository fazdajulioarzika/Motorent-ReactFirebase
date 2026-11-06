import { useEffect, useMemo, useState } from "react";

/** resetKey: isi dengan nilai filter/pencarian agar halaman kembali ke 1 saat filter berubah. */
export function usePagination<T>(items: T[], initialSize = 10, resetKey = "") {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);

  const slice = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize]
  );

  return {
    items: slice,
    props: {
      page: current,
      totalPages,
      total: items.length,
      pageSize,
      onPage: setPage,
      onPageSize: setPageSize,
    },
  };
}
