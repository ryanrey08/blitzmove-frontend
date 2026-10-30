import { api } from "@/services/api-client";
import type {
  DashboardData,
  DocumentFile,
  DocumentOwner,
  Driver,
  FleetDocument,
  FuelRecord,
  FuelSummary,
  ListParams,
  MaintenanceRecord,
  MaintenanceSummary,
  MonitoringData,
  Order,
  OrderStatus,
  Paginated,
  Resource,
  SearchResult,
  StopStatus,
  StatusCount,
  Trip,
  TripStatus,
  TripStop,
  Vehicle,
  VehicleLocation,
  VehiclePhoto,
} from "@/types/api";

type Payload = Record<string, unknown>;

/** Standard REST calls for a Laravel apiResource. */
function crud<T>(path: string) {
  return {
    list: (params: ListParams = {}) => api.get<Paginated<T>>(path, params),
    get: (id: number) => api.get<Resource<T>>(`${path}/${id}`),
    create: (data: Payload) => api.post<Resource<T>>(path, data),
    update: (id: number, data: Payload) => api.put<Resource<T>>(`${path}/${id}`, data),
    patch: (id: number, data: Payload) => api.patch<Resource<T>>(`${path}/${id}`, data),
    remove: (id: number) => api.delete<{ message: string }>(`${path}/${id}`),
  };
}

export const dashboardService = {
  get: (days = 14) => api.get<{ data: DashboardData }>("dashboard", { days }),
};

export const searchService = {
  search: (q: string, signal?: AbortSignal) => api.get<{ data: SearchResult[] }>("search", { q }, signal),
};

export const ordersService = {
  ...crud<Order>("orders"),
  summary: () => api.get<{ data: (StatusCount<OrderStatus> & { this_month: number; last_month: number })[]; meta: { delayed: number } }>("orders/summary"),
  filterOptions: () => api.get<{ data: { customers: string[]; destinations: string[] } }>("orders/filter-options"),
  changeStatus: (id: number, status: OrderStatus, reason?: string) =>
    api.patch<Resource<Order>>(`orders/${id}/status`, { status, reason }),
};

export const vehiclesService = {
  ...crud<Vehicle>("vehicles"),
  uploadPhoto: (id: number, file: File) => {
    const form = new FormData();
    form.set("photo", file);
    return api.post<Resource<VehiclePhoto>>(`vehicles/${id}/photos`, form);
  },
  makeCover: (id: number, photoId: number) => api.patch<{ message: string }>(`vehicles/${id}/photos/${photoId}/cover`),
  removePhoto: (id: number, photoId: number) => api.delete<{ message: string }>(`vehicles/${id}/photos/${photoId}`),
  summary: () => api.get<{ data: StatusCount[] }>("vehicles/summary"),
};

export interface DriverPerformance {
  completed_trips: number;
  /** % of completed trips that arrived by their estimated time; null without completed trips. */
  on_time_rate: number | null;
  cancelled_trips: number;
}

export const driversService = {
  ...crud<Driver>("drivers"),
  /** Driver detail plus 30-day performance from trip records. */
  detail: (id: number) => api.get<Resource<Driver> & { performance: DriverPerformance }>(`drivers/${id}`),
  summary: () => api.get<{ data: (StatusCount & { this_month: number; last_month: number })[] }>("drivers/summary"),
  uploadPhoto: (id: number, file: File) => {
    const form = new FormData();
    form.set("photo", file);
    return api.post<{ data: { photo: string }; message: string }>(`drivers/${id}/photo`, form);
  },
  removePhoto: (id: number) => api.delete<{ message: string }>(`drivers/${id}/photo`),
};

export const tripsService = {
  ...crud<Trip>("trips"),
  summary: () => api.get<{ data: (StatusCount<TripStatus> & { this_month: number; last_month: number })[] }>("trips/summary"),
  availability: (departure_at: string, estimated_arrival_at: string, exclude_trip_id?: number) =>
    api.get<{ data: { vehicles: Vehicle[]; drivers: Driver[] } }>("trips/availability", {
      departure_at,
      estimated_arrival_at,
      exclude_trip_id,
    }),
  nextNumber: () => api.get<{ data: { trip_number: string } }>("trips/next-number"),
  reassign: (id: number, data: { vehicle_id: number; driver_id: number; reason?: string }) =>
    api.post<Resource<Trip>>(`trips/${id}/reassign`, data),
  changeStatus: (id: number, status: TripStatus, notes?: string) => api.patch<Resource<Trip>>(`trips/${id}/status`, { status, notes }),
  /** Dispatch with an optional dispatch time and a last-minute vehicle/driver change (applied together server-side). */
  dispatch: (id: number, data: { notes?: string | null; dispatched_at?: string | null; vehicle_id?: number; driver_id?: number }) =>
    api.patch<Resource<Trip>>(`trips/${id}/status`, { status: "dispatched", ...data }),
  optimize: (id: number, traffic = false) => api.post<{ data: unknown }>(`trips/${id}/route/optimize`, { traffic }),
};

export const stopsService = {
  /** Stops across all trips, for the Itinerary table. */
  board: (params: ListParams = {}) => api.get<Paginated<TripStop> & { counts: Partial<Record<StopStatus, number>> }>("stops", params),
  list: (tripId: number) => api.get<{ data: TripStop[] }>(`trips/${tripId}/stops`),
  create: (tripId: number, data: Payload) => api.post<Resource<TripStop>>(`trips/${tripId}/stops`, data),
  update: (tripId: number, stopId: number, data: Payload) => api.patch<Resource<TripStop>>(`trips/${tripId}/stops/${stopId}`, data),
  remove: (tripId: number, stopId: number) => api.delete<{ message: string }>(`trips/${tripId}/stops/${stopId}`),
  /** `optimized` marks the order as coming from the routing provider; `distance_km` then saves its distance. */
  reorder: (tripId: number, stopIds: number[], options: { optimized?: boolean; distance_km?: number | null } = {}) =>
    api.put<{ data: TripStop[] }>(`trips/${tripId}/stops/reorder`, { stop_ids: stopIds, ...options }),
};

export const fuelService = {
  ...crud<FuelRecord>("fuel-records"),
  summary: (params: ListParams = {}) => api.get<{ data: FuelSummary }>("fuel-records/summary", params),
  /** Stations used before, most frequent first. */
  stations: () => api.get<{ data: string[] }>("fuel-records/stations"),
  uploadReceipt: (id: number, file: File) => {
    const form = new FormData();
    form.set("receipt", file);
    return api.post<{ data: { receipt: string }; message: string }>(`fuel-records/${id}/receipt`, form);
  },
  removeReceipt: (id: number) => api.delete<{ message: string }>(`fuel-records/${id}/receipt`),
};

export const documentsService = {
  list: (owner: DocumentOwner, params: ListParams = {}) => api.get<Paginated<FleetDocument>>("documents", { ...params, owner_type: owner }),
  /** Details only; files are added one at a time with addFile. */
  create: (data: Record<string, unknown>) => api.post<Resource<FleetDocument>>("documents", data),
  update: (owner: DocumentOwner, id: number, data: Record<string, unknown>) => api.put<Resource<FleetDocument>>(`documents/${owner}/${id}`, data),
  get: (owner: DocumentOwner, id: number) => api.get<Resource<FleetDocument>>(`documents/${owner}/${id}`),
  remove: (owner: DocumentOwner, id: number) => api.delete<{ message: string }>(`documents/${owner}/${id}`),
  /** Adds one file; resolves only after the API has stored it. */
  addFile: (owner: DocumentOwner, id: number, file: File, onProgress?: (fraction: number) => void) => {
    const form = new FormData();
    form.set("file", file);
    return api.upload<{ data: DocumentFile; message: string }>(`documents/${owner}/${id}/files`, form, onProgress);
  },
  removeFile: (owner: DocumentOwner, id: number, fileId: number) => api.delete<{ message: string }>(`documents/${owner}/${id}/files/${fileId}`),
  fileUrl: (file: DocumentFile, download = false) => api.url(file.path, download ? { download: 1 } : undefined),
};

export const maintenanceService = {
  ...crud<MaintenanceRecord>("maintenance-records"),
  summary: (params: ListParams = {}) => api.get<{ data: MaintenanceSummary }>("maintenance-records/summary", params),
  nextNumber: () => api.get<{ data: { reference_number: string } }>("maintenance-records/next-number"),
  /** Service providers and assignees used before, most frequent first. */
  options: () => api.get<{ data: { service_providers: string[]; assignees: string[] } }>("maintenance-records/options"),
  /** Adds one attachment; resolves only after the API has stored it. */
  addFile: (id: number, file: File, onProgress?: (fraction: number) => void) => {
    const form = new FormData();
    form.set("file", file);
    return api.upload<{ data: DocumentFile; message: string }>(`maintenance-records/${id}/files`, form, onProgress);
  },
  removeFile: (file: DocumentFile) => api.delete<{ message: string }>(file.path),
  fileUrl: (file: DocumentFile, download = false) => api.url(file.path, download ? { download: 1 } : undefined),
};

export const monitoringService = {
  get: () => api.get<{ data: MonitoringData }>("fleet/monitoring"),
};

export interface VehicleTrack {
  vehicle: Vehicle;
  locations: VehicleLocation[];
  /** PNG data URI of the track, rendered server-side; null without a map provider. */
  image: string | null;
}

export const gpsService = {
  track: (vehicleId: number, limit = 200) => api.get<{ data: VehicleTrack; meta: { map_provider_configured: boolean } }>(`gps/vehicles/${vehicleId}/track`, { limit }),
  vehicles: () =>
    api.get<{
      data: Vehicle[];
      /** places: reverse-geocoded name of each vehicle's last position, keyed by vehicle id (map provider only). */
      meta: { map_provider_configured: boolean; has_gps_data: boolean; last_reported_at: string | null; places: Record<string, string> };
    }>("gps/vehicles"),
  /** Fleet map; positions come from the database, the client only picks pin labels and colors. */
  map: (body: { markers: { vehicle_id: number; label: string; color: string }[]; style: "streets" | "satellite"; traffic: boolean }) =>
    api.post<{ data: { image: string | null; plotted: number } }>("gps/map", body),
  events: (limit = 15) => api.get<{ data: { at: string; type: "dispatched" | "departed" | "arrived" | "skipped" | "completed"; text: string }[] }>("gps/events", { limit }),
};

export interface RoutePreview {
  points: { index: number; label: string; lat: number | null; lng: number | null; matched: string | null; resolved: boolean }[];
  /** Stop indexes in driving order (first and last stay fixed). */
  order: number[];
  distance_km: number | null;
  duration_minutes: number | null;
  legs: { distance_km: number; duration_minutes: number }[];
  /** PNG data URI of the route, rendered server-side so the Mapbox secret token never reaches the browser. */
  image: string | null;
  unresolved: string[];
}

export interface RoutePlan {
  trip_id: number;
  /** Hex color of this route on the day map. */
  color: string;
  /** Stop ids in driving order. */
  stop_ids: number[];
  points: RoutePreview["points"];
  distance_km: number | null;
  duration_minutes: number | null;
  legs: RoutePreview["legs"];
  unresolved: string[];
}

export const routingService = {
  /** Several trips on one map; `optimize` proposes orders, `orders` previews given ones. Nothing is saved. */
  plan: (body: { trip_ids: number[]; optimize?: boolean; traffic?: boolean; orders?: Record<number, number[]> }) =>
    api.post<{ data: { routes: RoutePlan[]; image: string | null } }>("routing/plan", body),
  status: () => api.get<{ data: { configured: boolean; provider: string | null } }>("routing/status"),
  preview: (stops: { label: string; query?: string | null }[], options: { optimize?: boolean; legendInset?: boolean } = {}) =>
    api.post<{ data: RoutePreview }>("routing/preview", { stops, optimize: !!options.optimize, legend_inset: !!options.legendInset }),
};
