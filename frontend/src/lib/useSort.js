import { useMemo, useState } from "react";

/**
 * Sortable table hook.
 * Usage: const { sorted, sortKey, sortDir, toggleSort, headerProps } = useSort(rows, "date", "desc")
 * Then: <th {...headerProps("date")}>Tanggal</th>
 */
export function useSort(rows, defaultKey = null, defaultDir = "asc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a?.[sortKey], bv = b?.[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), "id", { numeric: true });
    });
    if (sortDir === "desc") arr.reverse();
    return arr;
  }, [rows, sortKey, sortDir]);

  const headerProps = (key) => ({
    onClick: () => toggleSort(key),
    className: "cursor-pointer select-none",
    "data-testid": `sort-${key}`,
    title: "Klik untuk mengurutkan",
  });

  const sortIndicator = (key) => {
    if (sortKey !== key) return " ⇅";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return { sorted, sortKey, sortDir, toggleSort, headerProps, sortIndicator };
}
