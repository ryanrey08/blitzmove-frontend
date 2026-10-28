"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Select } from "@/components/ui/form";
import { SearchInput } from "@/components/ui/search-input";
import { TRIP_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { tripsService } from "@/services/resources";

interface TripPickerProps {
  value: number | null;
  onChange: (id: number | null) => void;
  /** Restrict to scheduled / dispatched / in-progress trips. */
  openOnly?: boolean;
}

export function TripPicker({ value, onChange, openOnly }: TripPickerProps) {
  const [search, setSearch] = useState("");
  const { data, isFetching } = useQuery({
    queryKey: ["trips", "picker", search, openOnly],
    queryFn: () => tripsService.list({ search, per_page: 50, sort: "-departure_at", scope: openOnly ? "dispatch" : undefined }),
    placeholderData: keepPreviousData,
  });

  const options = (data?.data ?? []).map((t) => ({
    value: String(t.id),
    label: `${t.trip_number} · ${t.origin} → ${t.destination} · ${formatDate(t.departure_at, "MMM d")} · ${TRIP_STATUS[t.status].label}`,
  }));
  if (value && !options.some((o) => o.value === String(value))) options.unshift({ value: String(value), label: `Trip #${value}` });

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <SearchInput value={search} onChange={setSearch} placeholder="Find trip, place, driver, plate…" className="sm:w-72" />
      <Select
        value={value ? String(value) : ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        options={options}
        placeholder={isFetching ? "Loading trips…" : options.length ? "Select a trip" : "No trips found"}
        className="flex-1"
        aria-label="Trip"
      />
    </div>
  );
}
