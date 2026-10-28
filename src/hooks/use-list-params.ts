"use client";

import { useCallback, useState } from "react";
import type { ListParams } from "@/types/api";

/**
 * Search / filter / sort / pagination state for list pages. Any change other
 * than the page itself resets to page 1.
 */
export function useListParams(initial: ListParams = {}) {
  const [params, setParams] = useState<ListParams>({ page: 1, per_page: 10, ...initial });

  const update = useCallback((changes: Partial<ListParams>) => {
    setParams((current) => ({ ...current, ...changes, page: "page" in changes ? (changes.page as number) : 1 }));
  }, []);

  return { params, update, setPage: (page: number) => update({ page }) };
}
