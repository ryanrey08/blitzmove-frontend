"use client";

import { useQuery } from "@tanstack/react-query";
import { driversService, vehiclesService } from "@/services/resources";

/** Vehicle and driver pick-lists for filters and forms (first 100, sorted). */
export function useFleetOptions(enabled = true) {
  const vehicles = useQuery({ queryKey: ["vehicles", "options"], queryFn: () => vehiclesService.list({ per_page: 100, sort: "plate_number" }), enabled, staleTime: 60_000 });
  const drivers = useQuery({ queryKey: ["drivers", "options"], queryFn: () => driversService.list({ per_page: 100, sort: "full_name" }), enabled, staleTime: 60_000 });

  return {
    vehicles: vehicles.data?.data ?? [],
    drivers: drivers.data?.data ?? [],
    vehicleOptions: (vehicles.data?.data ?? []).map((v) => ({ value: String(v.id), label: `${v.plate_number} · ${v.make} ${v.model}` })),
    driverOptions: (drivers.data?.data ?? []).map((d) => ({ value: String(d.id), label: d.full_name })),
  };
}
