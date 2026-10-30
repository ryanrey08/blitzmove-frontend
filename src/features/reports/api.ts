import { ClipboardList, FileText, Fuel, MapPinned, Package, Route, Truck, UserRound, Wrench, type LucideIcon } from "lucide-react";
import { api } from "@/services/api-client";
import type { ListParams, Paginated, Resource } from "@/types/api";

export type ReportType = "fleet" | "trips" | "fuel" | "driver" | "maintenance" | "geofence" | "delivery" | "custom";

/** Labels match ReportType::label() in the API; `tone` is the solid icon tile in the Report List. */
export const REPORT_TYPES: Record<ReportType, { label: string; icon: LucideIcon; tone: string; title: string }> = {
  fleet: { label: "Fleet", icon: Truck, tone: "bg-blue-600 text-white", title: "Fleet Utilization Report" },
  trips: { label: "Trips", icon: Route, tone: "bg-sky-600 text-white", title: "Trip Report" },
  fuel: { label: "Fuel", icon: Fuel, tone: "bg-brand-600 text-white", title: "Fuel Report" },
  driver: { label: "Driver", icon: UserRound, tone: "bg-teal-600 text-white", title: "Driver Report" },
  maintenance: { label: "Maintenance", icon: Wrench, tone: "bg-blue-500 text-white", title: "Maintenance Report" },
  geofence: { label: "Geofence", icon: MapPinned, tone: "bg-violet-600 text-white", title: "Geofence Report" },
  delivery: { label: "Orders", icon: Package, tone: "bg-orange-500 text-white", title: "Delivery Report" },
  custom: { label: "Custom", icon: ClipboardList, tone: "bg-indigo-600 text-white", title: "Custom Report" },
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
  key: "delivered" | "in_transit" | "pending" | "delayed" | "cancelled";
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
  /** Custom Reports only: the saved builder configuration. */
  config: CustomReportConfig | null;
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

export type FuelGroupBy = "vehicle" | "driver" | "date" | "fuel_type";

/** Fuel Reports filters, on top of the period and vehicle/driver. A route is the origin and destination of the linked trip. */
export interface FuelReportFilters extends ReportFilters {
  fuel_type?: string;
  payment_method?: string;
  station?: string;
  route_origin?: string;
  route_destination?: string;
  group_by?: FuelGroupBy;
}

/** Liters, cost and number of fuel records for one slice of a breakdown. */
export interface FuelSlice {
  key: string;
  label: string;
  liters: number;
  cost: number;
  transactions: number;
}

export interface FuelReport {
  period: { from: string; to: string; days: number };
  previous_period: { from: string; to: string };
  /** Liters and cost are null when there are no fuel records; distance and efficiency need odometer readings. */
  stats: Record<"fuel_liters" | "fuel_cost" | "efficiency_km_per_liter" | "distance_km" | "transactions", Compared>;
  daily: { date: string; fuel_liters: number; fuel_cost: number }[];
  group_by: FuelGroupBy;
  /** By the chosen grouping: most liters first, or by date (7-day blocks from the period start). */
  groups: FuelSlice[];
  fuel_types: FuelSlice[];
  /** Named stations only, highest cost first. */
  stations: FuelSlice[];
  /** Origin → destination of trips that have fuel records, for the route filter. */
  routes: { origin: string; destination: string }[];
}

/** Period plus the previous period of the same length, shared by the report pages. */
interface PeriodPayload {
  period: { from: string; to: string; days: number };
  previous_period: { from: string; to: string };
}

/** Optional filters of the Trip, Driver, Maintenance, Utilization and Delivery report endpoints. */
export interface OperationsFilters extends ReportFilters {
  trip_status?: string;
  driver_status?: string;
  vehicle_status?: string;
  vehicle_type?: string;
  order_status?: string;
  customer?: string;
  /** Maintenance status as shown: scheduled, due_soon, overdue, in_progress, completed, cancelled. */
  status?: string;
  category?: string;
  service_type?: string;
}

export interface TripReport extends PeriodPayload {
  /** on_time_rate needs completed trips with an arrival time; duration needs actual departure and arrival; distance needs trip distance_km. */
  stats: Record<"total_trips" | "completed" | "cancelled" | "on_time_rate" | "avg_duration_hours" | "distance_km", Compared>;
  daily: { date: string; trips: number; completed: number }[];
  trip_status: TripStatusSlice[];
}

export interface DriverReportRow {
  id: number;
  employee_code: string;
  full_name: string;
  phone: string;
  status: string | null;
  trips: number;
  completed: number;
  /** Scheduled, dispatched or in progress. */
  pending: number;
  cancelled: number;
  on_time: number;
  arrived: number;
  completion_rate: number | null;
  on_time_rate: number | null;
  driving_hours: number;
  distance_km: number | null;
}

export interface DriverReport extends PeriodPayload {
  stats: Record<"active_drivers" | "total_trips" | "completion_rate" | "on_time_rate" | "driving_hours", Compared>;
  drivers: DriverReportRow[];
}

export interface MaintenanceReport extends PeriodPayload {
  stats: Record<"total" | "completed" | "overdue" | "total_cost", Compared>;
  by_status: { key: string; count: number }[];
  by_type: { key: string; label: string; count: number; cost: number | null }[];
  by_vehicle: { key: string; label: string; count: number; cost: number | null }[];
  /** Open work due in the next 30 days or overdue, soonest first (not limited to the period). */
  upcoming: { id: number; reference_number: string; vehicle: string | null; service_type: string; scheduled_date: string; display_status: string }[];
}

export interface UtilizationRow extends VehicleUtilization {
  status: string | null;
  completed_trips: number;
  active_hours: number;
  idle_hours: number;
}

export interface UtilizationReport extends PeriodPayload {
  stats: Record<"utilization_rate" | "active_vehicles" | "idle_vehicles" | "active_hours" | "distance_km", Compared>;
  daily: { date: string; active_vehicles: number }[];
  vehicles: UtilizationRow[];
}

export interface DeliveryReport extends PeriodPayload {
  stats: Record<"total_orders" | "delivered" | "on_time_rate" | "delayed" | "cancelled", Compared>;
  daily: { date: string; scheduled: number; delivered: number }[];
  by_status: { key: string; count: number }[];
  customers: { key: string; label: string; count: number; delivered: number }[];
}

export const CUSTOM_REPORTS_PATH = "/reports/custom";

export type CustomSource = "trips" | "orders" | "maintenance" | "fuel" | "drivers" | "vehicles";

export interface CustomReportConfig {
  source: CustomSource;
  columns: string[];
  sort?: string | null;
  search?: string | null;
  filters?: Record<string, string | null> | null;
}

export const reportsService = {
  overview: (filters: ReportFilters) => api.get<{ data: ReportOverview }>("reports/overview", { ...filters }),
  fuel: (filters: FuelReportFilters) => api.get<{ data: FuelReport }>("reports/fuel", { ...filters }),
  trips: (filters: OperationsFilters) => api.get<{ data: TripReport }>("reports/trips", { ...filters }),
  drivers: (filters: OperationsFilters) => api.get<{ data: DriverReport }>("reports/drivers", { ...filters }),
  maintenance: (filters: OperationsFilters) => api.get<{ data: MaintenanceReport }>("reports/maintenance", { ...filters }),
  utilization: (filters: OperationsFilters) => api.get<{ data: UtilizationReport }>("reports/utilization", { ...filters }),
  deliveries: (filters: OperationsFilters) => api.get<{ data: DeliveryReport }>("reports/deliveries", { ...filters }),
  list: (params: ListParams = {}) => api.get<Paginated<Report>>("reports", params),
  get: (id: number) => api.get<Resource<ReportDetail>>(`reports/${id}`),
  create: (data: ReportFilters & { name: string; type: ReportType; config?: CustomReportConfig }) => api.post<Resource<Report>>("reports", data),
  remove: (id: number) => api.delete<{ message: string }>(`reports/${id}`),
};

/** Donut colors per bucket (Delivered = completed, In Transit / Delayed = on the road before / after the ETA, Pending = scheduled). */
export const TRIP_STATUS_COLORS: Record<TripStatusSlice["key"], string> = {
  delivered: "#16a34a",
  in_transit: "#3b82f6",
  pending: "#f59e0b",
  delayed: "#ef4444",
  cancelled: "#98a2b3",
};
