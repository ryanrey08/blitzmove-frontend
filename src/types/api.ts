// Shapes returned by the BlitzMove Laravel API (app/Http/Resources).
// Status values mirror the PHP enums in blitzmove-backend/app/Enums.

export type UserRole = "admin" | "manager" | "dispatcher" | "viewer";
export type OrderStatus = "pending" | "scheduled" | "in_transit" | "delivered" | "cancelled";
export type TripStatus = "scheduled" | "dispatched" | "in_progress" | "completed" | "cancelled";
export type VehicleStatus = "available" | "on_trip" | "maintenance" | "inactive";
export type DriverStatus = "available" | "on_trip" | "on_leave" | "suspended" | "inactive";
export type StopType = "pickup" | "stop" | "dropoff";
export type StopActivity = "pickup" | "delivery";
export type TripType = "delivery" | "pickup" | "transfer" | "return";
export type TripPriority = "low" | "normal" | "high" | "urgent";
export type StopStatus = "pending" | "arrived" | "completed" | "skipped";
export type VehicleType =
  | "closed_van"
  | "wing_van"
  | "cargo_truck"
  | "refrigerated_truck"
  | "flatbed"
  | "tanker"
  | "pickup"
  | "motorcycle";
export type LicenseType = "professional" | "non_professional";
export type FuelType = "diesel" | "gasoline" | "electric" | "lpg";
export type PaymentMethod = "cash" | "fuel_card" | "credit_card" | "debit_card" | "company_account" | "e_wallet";
export type VehicleDocumentType = "registration" | "official_receipt" | "insurance" | "permit" | "inspection" | "emission_test" | "other";
export type DriverDocumentType =
  | "license"
  | "medical_certificate"
  | "nbi_clearance"
  | "drug_test"
  | "training_certificate"
  | "contract"
  | "other";
export type ExpiryStatus = "valid" | "expiring_soon" | "expired" | "no_expiry";
export type DocumentOwner = "vehicle" | "driver";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  job_title: string | null;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  permissions: { manage_operations: boolean; manage_fleet: boolean };
}

export interface Driver {
  id: number;
  employee_code: string;
  full_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  license_number: string;
  license_type: LicenseType;
  license_expiry: string;
  license_expired: boolean;
  date_hired: string | null;
  date_of_birth: string | null;
  license_restrictions: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  /** API path of the driver's photo; open it with api.url(). */
  photo: string | null;
  status: DriverStatus;
  notes: string | null;
  assigned_vehicle?: Vehicle | null;
  documents_count?: number;
  trips_count?: number;
  completed_trips_count?: number;
  recent_trips?: Trip[];
  created_at: string;
  updated_at: string;
}

export type VehicleFeature = "gps_tracker" | "dash_camera" | "ref_cooler" | "tail_lift" | "auxiliary_power";

export interface VehiclePhoto {
  id: number;
  vehicle_id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  position: number;
  /** API path; open it with api.url(). */
  path: string;
}

export interface VehicleLocation {
  id: number;
  vehicle_id: number;
  trip_id: number | null;
  latitude: number;
  longitude: number;
  speed_kph: number | null;
  heading: number | null;
  source: string | null;
  recorded_at: string;
}

export interface Vehicle {
  id: number;
  plate_number: string;
  vehicle_type: VehicleType;
  make: string;
  model: string;
  year: number;
  capacity_kg: number | null;
  fuel_type: FuelType;
  vin: string | null;
  color: string | null;
  body_type: string | null;
  wheels: number | null;
  engine_number: string | null;
  home_depot: string | null;
  gps_device_id: string | null;
  odometer_km: number | null;
  acquired_at: string | null;
  cargo_volume_m3: number | null;
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  fuel_tank_l: number | null;
  fuel_economy_kml: number | null;
  emission_standard: string | null;
  features: VehicleFeature[];
  /** Expiry of the current registration / insurance document (detail responses). */
  registration_expiry?: string | null;
  insurance_expiry?: string | null;
  photos?: VehiclePhoto[];
  /** API path of the cover photo; open it with api.url(). */
  cover_photo?: string | null;
  status: VehicleStatus;
  assigned_driver_id: number | null;
  assigned_driver?: Driver | null;
  active_trip?: Trip | null;
  latest_location?: VehicleLocation | null;
  documents_count?: number;
  trips_count?: number;
  recent_trips?: Trip[];
  recent_fuel_records?: FuelRecord[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_contact: string;
  pickup_address: string;
  delivery_address: string;
  scheduled_pickup_at: string;
  scheduled_delivery_at: string;
  vehicle_id: number | null;
  driver_id: number | null;
  vehicle?: Vehicle | null;
  driver?: Driver | null;
  cargo_description: string;
  quantity: number;
  weight_kg: number | null;
  amount: number | null;
  payment_terms: string | null;
  /** Open order whose scheduled delivery time has passed. */
  is_delayed: boolean;
  delivery_instructions: string | null;
  status: OrderStatus;
  allowed_transitions: OrderStatus[];
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  trips?: Trip[];
  created_by?: User | null;
  created_at: string;
  updated_at: string;
}

export interface TripStop {
  id: number;
  trip_id: number;
  sequence: number;
  type: StopType;
  activity: StopActivity | null;
  location_name: string;
  address: string | null;
  order_id: number | null;
  order?: Order | null;
  /** Included on the cross-trip stops list (Itinerary). */
  trip?: Trip;
  estimated_arrival_at: string | null;
  actual_arrival_at: string | null;
  status: StopStatus;
  notes: string | null;
}

export interface DispatchAssignment {
  id: number;
  vehicle?: Vehicle;
  driver?: Driver;
  assigned_by?: User | null;
  assigned_at: string;
  released_at: string | null;
  reason: string | null;
}

export interface Trip {
  id: number;
  trip_number: string;
  reference_no: string | null;
  trip_type: TripType;
  priority: TripPriority;
  order_id: number | null;
  vehicle_id: number;
  driver_id: number;
  co_driver_id: number | null;
  order?: Order | null;
  vehicle?: Vehicle;
  driver?: Driver;
  co_driver?: Driver | null;
  origin: string;
  destination: string;
  departure_at: string;
  estimated_arrival_at: string;
  actual_departure_at: string | null;
  actual_arrival_at: string | null;
  distance_km: number | null;
  /** Set when the stop order came from route optimization; cleared when stops change by hand. */
  route_optimized_at: string | null;
  status: TripStatus;
  allowed_transitions: TripStatus[];
  dispatched_at: string | null;
  dispatched_by?: User | null;
  dispatch_notes: string | null;
  notes: string | null;
  created_by?: User | null;
  stops_count?: number;
  stops?: TripStop[];
  assignments?: DispatchAssignment[];
  created_at: string;
  updated_at: string;
}

export interface FuelRecord {
  id: number;
  vehicle_id: number;
  driver_id: number | null;
  trip_id: number | null;
  vehicle?: Vehicle;
  driver?: Driver | null;
  trip?: Trip | null;
  fueled_at: string;
  fuel_type: FuelType;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  payment_method: PaymentMethod | null;
  odometer_km: number | null;
  station: string | null;
  receipt_number: string | null;
  /** Free-form PO / trip / reference number. */
  reference_number: string | null;
  /** API path of the receipt photo; open it with api.url(). */
  receipt: string | null;
  notes: string | null;
  created_at: string;
}

export type MaintenanceType =
  | "preventive_maintenance"
  | "oil_change"
  | "tire_service"
  | "brake_service"
  | "engine_repair"
  | "transmission_service"
  | "electrical"
  | "aircon_service"
  | "suspension"
  | "body_repair"
  | "inspection"
  | "other";
export type MaintenanceCategory = "preventive" | "corrective" | "inspection" | "emergency";
export type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
/** Stored status, with scheduled work shown as due_soon / overdue by its date. */
export type MaintenanceDisplayStatus = MaintenanceStatus | "due_soon" | "overdue";

export interface MaintenancePart {
  name: string;
  quantity: number;
  unit_cost: number;
}

export interface MaintenanceRecord {
  id: number;
  reference_number: string;
  vehicle_id: number;
  vehicle?: Vehicle;
  service_type: MaintenanceType;
  category: MaintenanceCategory;
  status: MaintenanceStatus;
  display_status: MaintenanceDisplayStatus;
  /** "Next Due" while the work is open. */
  scheduled_date: string;
  /** The day the work was done. */
  service_date: string | null;
  /** Previous completed service of the same type on this vehicle. */
  last_service_date?: string | null;
  odometer_km: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  parts_total: number;
  service_provider: string | null;
  assigned_to: string | null;
  reminder_days: number | null;
  description: string | null;
  parts: MaintenancePart[];
  checklist: { item: string; done: boolean }[];
  notes: string | null;
  files?: DocumentFile[];
  files_count?: number;
  started_at: string | null;
  completed_at: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

/** Card counts now and the same figure a month earlier. */
export type MaintenanceSummary = Record<"total" | "upcoming" | "overdue" | "completed_this_month" | "in_progress", { count: number; previous: number }>;

export interface DocumentFile {
  id: number;
  original_name: string;
  mime_type: string | null;
  file_size: number | null;
  /** API path (relative); add ?download=1 to save instead of view. */
  path: string;
  created_at: string;
}

export interface FleetDocument {
  id: number;
  owner_type: DocumentOwner;
  vehicle_id?: number;
  driver_id?: number;
  vehicle?: Vehicle;
  driver?: Driver;
  document_type: VehicleDocumentType | DriverDocumentType;
  title: string;
  document_number: string | null;
  issued_at: string | null;
  expires_at: string | null;
  expiry_status: ExpiryStatus;
  issuing_authority: string | null;
  /** Loaded on list and detail responses (not on the monitoring summary). */
  files?: DocumentFile[];
  files_count?: number;
  has_file?: boolean;
  notes: string | null;
  uploaded_by?: User | null;
  created_at: string;
  updated_at: string;
}

export interface StatusCount<S extends string = string> {
  status: S;
  label: string;
  count: number;
}

export interface DashboardData {
  stats: {
    total_orders: number;
    active_trips: number;
    available_vehicles: number;
    total_vehicles: number;
    total_drivers: number;
    pending_deliveries: number;
    completed_trips: number;
  };
  activity: { date: string; orders: number; trips_completed: number }[];
  order_status: StatusCount<OrderStatus>[];
  vehicle_status: StatusCount<VehicleStatus>[];
  driver_status: StatusCount<DriverStatus>[];
  recent_orders: Order[];
  active_trips: Trip[];
}

/** One day's totals on the Monitoring page; null where there is no source data. */
export interface MonitoringDay {
  completed: number;
  delayed: number;
  cancelled: number;
  /** Planned distance of trips completed that day. */
  distance_km: number;
  /** Liters entered in fuel records that day. */
  fuel_liters: number;
  /** Average of moving GPS samples; null when no device reported a speed. */
  average_speed_kph: number | null;
  gps_samples: number;
}

export interface MonitoringData {
  active_trips: { total: number; on_time: number; delayed: number; cancelled_today: number };
  today: MonitoringDay;
  /** The same weekday last week (whole day). */
  last_week: MonitoringDay;
  gps: { has_data: boolean; last_reported_at: string | null };
}

export interface TripEvent {
  at: string;
  type: "dispatched" | "departed" | "arrived" | "skipped" | "completed";
  vehicle_id: number;
  trip_id: number;
  trip_number: string;
  location: string;
  text: string;
}

export interface FuelSummary {
  entries: number;
  total_liters: number;
  total_cost: number;
  average_price_per_liter: number | null;
}

export interface SearchResult {
  type: "order" | "trip" | "vehicle" | "driver";
  id: number;
  title: string;
  subtitle: string;
  url: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null };
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
}

export interface Resource<T> {
  data: T;
  message?: string;
}

export interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  sort?: string;
  [filter: string]: string | number | boolean | undefined;
}
