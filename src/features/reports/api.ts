import { ClipboardList, FileText, Fuel, MapPinned, Package, Route, Truck, UserRound, Wrench, type LucideIcon } from "lucide-react";
import { api } from "@/services/api-client";
import type { ListParams, Paginated, Resource } from "@/types/api";

export type ReportType = "fleet" | "trips" | "fuel" | "driver" | "maintenance" | "geofence" | "delivery" | "custom";

/** Labels match ReportType::label() in the API. */
export const REPORT_TYPES: Record<ReportType, { label: string; icon: LucideIcon; tone: string; title: string }> = {
  fleet: { label: "Fleet Utilization", icon: Truck, tone: "bg-sky-50 text-sky-600", title: "Fleet Utilization Report" },
  trips: { label: "Trips", icon: Route, tone: "bg-emerald-50 text-emerald-600", title: "Trip Report" },
  fuel: { label: "Fuel", icon: Fuel, tone: "bg-brand-50 text-brand-600", title: "Fuel Report" },
  driver: { label: "Driver", icon: UserRound, tone: "bg-violet-50 text-violet-600", title: "Driver Report" },
  maintenance: { label: "Maintenance", icon: Wrench, tone: "bg-orange-50 text-orange-500", title: "Maintenance Report" },
  geofence: { label: "Geofence", icon: MapPinned, tone: "bg-indigo-50 text-indigo-600", title: "Geofence Report" },
  delivery: { label: "Orders / Delivery", icon: Package, tone: "bg-amber-50 text-amber-600", title: "Delivery Report" },
  custom: { label: "Custom", icon: ClipboardList, tone: "bg-ink-100 text-ink-600", title: "Custom Report" },
};

export const REPORT_TYPE_OPTIONS = (Object.keys(REPORT_TYPES) as ReportType[]).map((value) => ({ value, label: REPORT_TYPES[value].label }));

export const reportIcon = (type: string): LucideIcon => REPORT_TYPES[type as ReportType]?.icon ?? FileText;

export interface ReportFilters {
  from: string;
  to: string;
  vehicle_id?: string;
  driver_id?: string;
}

/** A metric for the selected period and the same-length period just before it; null = no source data. */
export interface Compared {
  value: number | null;
  previous: number | null;
}

export interface TripStatusSlice {
  key: "completed" | "in_transit" | "scheduled" | "cancelled";
  label: string;
  count: number;
}

export interface ReportOverview {
  period: { from: string; to: string; days: number };
  previous_period: { from: string; to: string };
  stats: Record<"distance_km" | "fuel_liters" | "fuel_cost" | "total_trips" | "on_time_rate", Compared>;
  on_time: { completed: number; on_time: number };
  /** distance_km is null on every day when no odometer readings cover the period. */
  daily: { date: string; distance_km: number | null; fuel_liters: number; fuel_cost: number }[];
  trip_status: TripStatusSlice[];
}

export interface Report {
  id: number;
  name: string;
  type: ReportType;
  type_label: string;
  period_from: string;
  period_to: string;
  vehicle_id: number | null;
  driver_id: number | null;
  generated_by: { id: number; name: string } | null;
  created_at: string;
}

export interface VehicleUtilization {
  id: number;
  plate_number: string;
  vehicle_type: string | null;
  make: string | null;
  model: string | null;
  distance_km: number | null;
  trips: number;
  active_days: number;
  utilization_rate: number;
}

export interface ReportDetail extends Report {
  preview: {
    period: { from: string; to: string; days: number };
    summary: { total_vehicles: number; active_vehicles: number; total_distance_km: number | null; total_trips: number };
    vehicles: VehicleUtilization[];
    trip_status: TripStatusSlice[];
  };
}

export const reportsService = {
  overview: (filters: ReportFilters) => api.get<{ data: ReportOverview }>("reports/overview", { ...filters }),
  list: (params: ListParams = {}) => api.get<Paginated<Report>>("reports", params),
  get: (id: number) => api.get<Resource<ReportDetail>>(`reports/${id}`),
  create: (data: ReportFilters & { name: string; type: ReportType }) => api.post<Resource<Report>>("reports", data),
  remove: (id: number) => api.delete<{ message: string }>(`reports/${id}`),
};

/** Donut colors per bucket: green / blue / amber / red. */
export const TRIP_STATUS_COLORS: Record<TripStatusSlice["key"], string> = {
  completed: "#16a34a",
  in_transit: "#3b82f6",
  scheduled: "#f59e0b",
  cancelled: "#ef4444",
};
