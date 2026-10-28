"use client";

import { useQuery } from "@tanstack/react-query";
import { tripsService } from "@/services/resources";

export function useTrip(id: number | null) {
  return useQuery({ queryKey: ["trip", id], queryFn: () => tripsService.get(id!), enabled: !!id });
}

/** Query keys refreshed after any trip change. */
export const TRIP_KEYS = [["trips"], ["trip"], ["orders"], ["order"], ["dashboard"], ["monitoring"], ["vehicles"], ["drivers"]];
