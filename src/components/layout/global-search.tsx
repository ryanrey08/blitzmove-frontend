"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPinned, Package, Search, Truck, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { searchService } from "@/services/resources";
import type { SearchResult } from "@/types/api";

const ICONS: Record<SearchResult["type"], typeof Package> = { order: Package, trip: MapPinned, vehicle: Truck, driver: UserIcon };

export function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounced = useDebounce(term.trim(), 300);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: ({ signal }) => searchService.search(debounced, signal),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });
  const results = debounced.length >= 2 ? (data?.data ?? []) : [];

  useEffect(() => setHighlight(0), [debounced]);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (result: SearchResult) => {
    setOpen(false);
    setTerm("");
    router.push(result.url);
  };

  return (
    <div ref={ref} className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        type="search"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setHighlight((h) => Math.min(h + 1, results.length - 1));
          if (e.key === "ArrowUp") setHighlight((h) => Math.max(h - 1, 0));
          if (e.key === "Enter" && results[highlight]) go(results[highlight]);
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search orders, trips, vehicles, drivers…"
        aria-label="Search orders, trips, vehicles and drivers"
        className="h-11 w-full rounded-lg border border-ink-200 bg-ink-50 pr-9 pl-10 text-sm placeholder:text-ink-400 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/15 focus:outline-none"
      />
      {isFetching && <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />}

      {open && debounced.length >= 2 && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-lg border border-ink-100 bg-white shadow-lg">
          {results.length === 0 && !isFetching ? (
            <p className="px-4 py-3 text-sm text-ink-500">No matches for “{debounced}”.</p>
          ) : (
            <ul role="listbox">
              {results.map((result, i) => {
                const Icon = ICONS[result.type];
                return (
                  <li key={`${result.type}-${result.id}`} role="option" aria-selected={i === highlight}>
                    <button
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => go(result)}
                      className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", i === highlight && "bg-ink-50")}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink-900">{result.title}</span>
                        <span className="block truncate text-xs text-ink-500">{result.subtitle}</span>
                      </span>
                      <span className="ml-auto text-[0.65rem] tracking-wide text-ink-400 uppercase">{result.type}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
