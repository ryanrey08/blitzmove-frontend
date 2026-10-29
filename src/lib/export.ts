import { format } from "date-fns";
import { downloadFile, toCsv } from "@/lib/csv";
import type { ListParams, Paginated } from "@/types/api";

/** Loads every page of a paginated list (100 at a time) for export. */
export async function fetchAllPages<T>(load: (params: ListParams) => Promise<Paginated<T>>, params: ListParams): Promise<T[]> {
  let rows: T[] = [];
  for (let page = 1; ; page++) {
    const result = await load({ ...params, page, per_page: 100 });
    rows = rows.concat(result.data);
    if (page >= result.meta.last_page) return rows;
  }
}

/** Downloads rows as `blitzmove-<name>-<timestamp>.csv`. */
export function exportCsv(name: string, header: string[], rows: (string | number | null | undefined)[][]) {
  downloadFile(`blitzmove-${name}-${format(new Date(), "yyyyMMdd-HHmm")}.csv`, toCsv([header, ...rows]));
}
