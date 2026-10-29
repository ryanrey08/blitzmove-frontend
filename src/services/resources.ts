import { api } from "@/services/api-client";
import type {
  DashboardData,
  DocumentOwner,
  Driver,
  FleetDocument,
  FuelRecord,
  FuelSummary,
  ListParams,
  MonitoringData,
  Order,
  OrderStatus,
  Paginated,
  Resource,
  SearchResult,
  StatusCount,
  Trip,
  TripStatus,
  TripStop,
  Vehicle,
  VehicleLocation,
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
  summary: () => api.get<{ data: StatusCount[] }>("vehicles/summary"),
};

export const driversService = {
  ...crud<Driver>("drivers"),
  summary: () => api.get<{ data: StatusCount[] }>("drivers/summary"),
};

export const tripsService = {
  ...crud<Trip>("trips"),
  summary: () => api.get<{ data: StatusCount<TripStatus>[] }>("trips/summary"),
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
  optimize: (id: number) => api.post<{ data: unknown }>(`trips/${id}/route/optimize`),
};

export const stopsService = {
  /** Stops across all trips, for the Itinerary table. */
  board: (params: ListParams = {}) => api.get<Paginated<TripStop>>("stops", params),
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
};

export const documentsService = {
  list: (owner: DocumentOwner, params: ListParams = {}) => api.get<Paginated<FleetDocument>>("documents", { ...params, owner_type: owner }),
  create: (form: FormData) => api.post<Resource<FleetDocument>>("documents", form),
  /** Multipart updates use POST + _method=PUT because PHP only parses multipart bodies on POST. */
  update: (owner: DocumentOwner, id: number, form: FormData) => {
    form.set("_method", "PUT");
    return api.post<Resource<FleetDocument>>(`documents/${owner}/${id}`, form);
  },
  remove: (owner: DocumentOwner, id: number) => api.delete<{ message: string }>(`documents/${owner}/${id}`),
  downloadUrl: (owner: DocumentOwner, id: number) => api.url(`documents/${owner}/${id}/download`),
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
    api.get<{ data: Vehicle[]; meta: { map_provider_configured: boolean; has_gps_data: boolean; last_reported_at: string | null } }>(
      "gps/vehicles",
    ),
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

export const routingService = {
  status: () => api.get<{ data: { configured: boolean; provider: string | null } }>("routing/status"),
  preview: (stops: { label: string; query?: string | null }[], options: { optimize?: boolean; legendInset?: boolean } = {}) =>
    api.post<{ data: RoutePreview }>("routing/preview", { stops, optimize: !!options.optimize, legend_inset: !!options.legendInset }),
};
