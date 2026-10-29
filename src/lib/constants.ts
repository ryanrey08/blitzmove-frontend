import type {
  DriverDocumentType,
  DriverStatus,
  ExpiryStatus,
  FuelType,
  LicenseType,
  OrderStatus,
  StopStatus,
  StopActivity,
  StopType,
  TripPriority,
  TripStatus,
  TripType,
  VehicleDocumentType,
  VehicleStatus,
  VehicleType,
} from "@/types/api";

// Labels match the PHP enums' label() output so UI and API never disagree.

export type Tone = "gray" | "red" | "amber" | "green" | "blue" | "indigo" | "violet" | "orange";

export interface Option<V extends string = string> {
  value: V;
  label: string;
}

function options<V extends string>(labels: Record<V, string>): Option<V>[] {
  return (Object.keys(labels) as V[]).map((value) => ({ value, label: labels[value] }));
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "amber" },
  scheduled: { label: "Scheduled", tone: "indigo" },
  in_transit: { label: "In Transit", tone: "blue" },
  delivered: { label: "Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "gray" },
};

export const TRIP_STATUS: Record<TripStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "indigo" },
  dispatched: { label: "Dispatched", tone: "orange" },
  in_progress: { label: "In Progress", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "gray" },
};

export const VEHICLE_STATUS: Record<VehicleStatus, { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "green" },
  on_trip: { label: "On Trip", tone: "blue" },
  maintenance: { label: "Maintenance", tone: "orange" },
  inactive: { label: "Inactive", tone: "gray" },
};

export const DRIVER_STATUS: Record<DriverStatus, { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "green" },
  on_trip: { label: "On Trip", tone: "blue" },
  on_leave: { label: "On Leave", tone: "amber" },
  suspended: { label: "Suspended", tone: "red" },
  inactive: { label: "Inactive", tone: "gray" },
};

export const STOP_STATUS: Record<StopStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "gray" },
  arrived: { label: "Arrived", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  skipped: { label: "Skipped", tone: "amber" },
};

export const STOP_TYPE: Record<StopType, { label: string; tone: Tone }> = {
  pickup: { label: "Start", tone: "green" },
  stop: { label: "Stop", tone: "blue" },
  dropoff: { label: "End", tone: "red" },
};

export const STOP_ACTIVITY: Record<StopActivity, { label: string; tone: Tone }> = {
  pickup: { label: "Pickup", tone: "blue" },
  delivery: { label: "Delivery", tone: "green" },
};

export const TRIP_PRIORITY: Record<TripPriority, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "gray" },
  normal: { label: "Normal", tone: "blue" },
  high: { label: "High", tone: "orange" },
  urgent: { label: "Urgent", tone: "red" },
};

export const TRIP_TYPES = options<TripType>({ delivery: "Delivery", pickup: "Pickup", transfer: "Transfer", return: "Return" });

export const EXPIRY_STATUS: Record<ExpiryStatus, { label: string; tone: Tone }> = {
  valid: { label: "Valid", tone: "green" },
  expiring_soon: { label: "Expiring Soon", tone: "amber" },
  expired: { label: "Expired", tone: "red" },
  no_expiry: { label: "No Expiry", tone: "gray" },
};

export const VEHICLE_TYPES = options<VehicleType>({
  closed_van: "Closed Van",
  wing_van: "Wing Van",
  cargo_truck: "Cargo Truck",
  refrigerated_truck: "Refrigerated Truck",
  flatbed: "Flatbed",
  tanker: "Tanker",
  pickup: "Pickup",
  motorcycle: "Motorcycle",
});

export const LICENSE_TYPES = options<LicenseType>({ professional: "Professional", non_professional: "Non Professional" });

export const FUEL_TYPES = options<FuelType>({ diesel: "Diesel", gasoline: "Gasoline", electric: "Electric", lpg: "LPG" });

export const VEHICLE_DOCUMENT_TYPES = options<VehicleDocumentType>({
  registration: "Registration",
  insurance: "Insurance",
  permit: "Permit",
  inspection: "Inspection",
  emission_test: "Emission Test",
  other: "Other",
});

export const DRIVER_DOCUMENT_TYPES = options<DriverDocumentType>({
  license: "License",
  medical_certificate: "Medical Certificate",
  nbi_clearance: "NBI Clearance",
  drug_test: "Drug Test",
  training_certificate: "Training Certificate",
  contract: "Contract",
  other: "Other",
});

export const statusOptions = <S extends string>(map: Record<S, { label: string }>): Option<S>[] =>
  (Object.keys(map) as S[]).map((value) => ({ value, label: map[value].label }));

export const labelOf = (list: Option[], value: string | null | undefined) =>
  list.find((o) => o.value === value)?.label ?? value ?? "—";

export const PAGE_SIZES = [10, 25, 50];
