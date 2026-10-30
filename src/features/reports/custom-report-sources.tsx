import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/badge";
import {
  DRIVER_STATUS,
  FUEL_TYPES,
  LICENSE_TYPES,
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_STATUS,
  MAINTENANCE_TYPES,
  ORDER_STATUS,
  PAYMENT_METHODS,
  TRIP_PRIORITY,
  TRIP_STATUS,
  TRIP_TYPES,
  VEHICLE_STATUS,
  VEHICLE_TYPES,
  labelOf,
  statusOptions,
  type Option,
} from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { driversService, fuelService, maintenanceService, ordersService, tripsService, vehiclesService } from "@/services/resources";
import type { Driver, FuelRecord, ListParams, MaintenanceRecord, Order, Paginated, Trip, Vehicle } from "@/types/api";
import type { CustomSource } from "./api";
import { hoursBetween } from "./report-page";

/**
 * Data sources for Custom Reports. Each one reads an existing list endpoint (with its own search, filters, sorting
 * and pagination); a field is a column the user can pick. `sortKey` is the API sort field when the endpoint
 * supports sorting by that column.
 */

type Cell = string | number | null | undefined;

export interface CustomField<T> {
  key: string;
  label: string;
  /** Value for the CSV export. */
  value: (row: T) => Cell;
  /** Rich cell for the preview; falls back to `value`. */
  render?: (row: T) => ReactNode;
  sortKey?: string;
  /** Selected when the source is first chosen. */
  preset?: boolean;
}

export interface CustomSourceDef<T> {
  label: string;
  description: string;
  noun: string;
  load: (params: ListParams) => Promise<Paginated<T>>;
  /** Query params for the period; none for master data (drivers, vehicles). */
  period?: { from: string; to: string; label: string };
  status?: { label: string; options: Option[] };
  vehicle?: boolean;
  driver?: boolean;
  defaultSort: string;
  fields: CustomField<T>[];
}

const date = (v: string | null | undefined) => (v ? formatDateTime(v) : "");
const day = (v: string | null | undefined) => (v ? formatDate(v) : "");
const hours = (h: number | null) => (h === null ? null : Math.round(h * 10) / 10);

const trips: CustomSourceDef<Trip> = {
  label: "Trips",
  description: "Trip schedule, assignments, timings and status.",
  noun: "trips",
  load: tripsService.list,
  period: { from: "from", to: "to", label: "Trips departing in this period." },
  status: { label: "Trip Status", options: statusOptions(TRIP_STATUS) },
  vehicle: true,
  driver: true,
  defaultSort: "-departure_at",
  fields: [
    { key: "trip_number", label: "Trip No.", value: (t) => t.trip_number, sortKey: "trip_number", preset: true },
    { key: "reference_no", label: "Reference No.", value: (t) => t.reference_no },
    { key: "trip_type", label: "Trip Type", value: (t) => labelOf(TRIP_TYPES, t.trip_type) },
    { key: "priority", label: "Priority", value: (t) => TRIP_PRIORITY[t.priority]?.label ?? t.priority },
    { key: "vehicle", label: "Vehicle", value: (t) => t.vehicle?.plate_number, preset: true },
    { key: "driver", label: "Driver", value: (t) => t.driver?.full_name, preset: true },
    { key: "origin", label: "Origin", value: (t) => t.origin, preset: true },
    { key: "destination", label: "Destination", value: (t) => t.destination, preset: true },
    { key: "departure_at", label: "Scheduled Departure", value: (t) => date(t.departure_at), sortKey: "departure_at", preset: true },
    { key: "estimated_arrival_at", label: "Estimated Arrival", value: (t) => date(t.estimated_arrival_at), sortKey: "estimated_arrival_at" },
    { key: "actual_departure_at", label: "Actual Departure", value: (t) => date(t.actual_departure_at) },
    { key: "actual_arrival_at", label: "Actual Arrival", value: (t) => date(t.actual_arrival_at) },
    { key: "duration", label: "Duration (h)", value: (t) => hours(hoursBetween(t.actual_departure_at, t.actual_arrival_at)) },
    { key: "distance_km", label: "Distance (km)", value: (t) => t.distance_km },
    { key: "stops", label: "Stops", value: (t) => t.stops_count },
    { key: "order", label: "Order No.", value: (t) => t.order?.order_number },
    { key: "status", label: "Status", value: (t) => TRIP_STATUS[t.status]?.label, render: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} />, sortKey: "status", preset: true },
  ],
};

const orders: CustomSourceDef<Order> = {
  label: "Orders / Deliveries",
  description: "Customer orders with pickup, delivery and status.",
  noun: "orders",
  load: ordersService.list,
  period: { from: "delivery_from", to: "delivery_to", label: "Orders scheduled for delivery in this period." },
  status: { label: "Order Status", options: statusOptions(ORDER_STATUS) },
  vehicle: true,
  driver: true,
  defaultSort: "-scheduled_delivery_at",
  fields: [
    { key: "order_number", label: "Order No.", value: (o) => o.order_number, sortKey: "order_number", preset: true },
    { key: "customer_name", label: "Customer", value: (o) => o.customer_name, sortKey: "customer_name", preset: true },
    { key: "customer_contact", label: "Customer Contact", value: (o) => o.customer_contact },
    { key: "pickup_address", label: "Pickup Address", value: (o) => o.pickup_address },
    { key: "delivery_address", label: "Delivery Address", value: (o) => o.delivery_address, preset: true },
    { key: "scheduled_pickup_at", label: "Scheduled Pickup", value: (o) => date(o.scheduled_pickup_at), sortKey: "scheduled_pickup_at" },
    { key: "scheduled_delivery_at", label: "Scheduled Delivery", value: (o) => date(o.scheduled_delivery_at), sortKey: "scheduled_delivery_at", preset: true },
    { key: "delivered_at", label: "Delivered At", value: (o) => date(o.delivered_at), sortKey: "delivered_at" },
    { key: "vehicle", label: "Vehicle", value: (o) => o.vehicle?.plate_number, preset: true },
    { key: "driver", label: "Driver", value: (o) => o.driver?.full_name },
    { key: "cargo_description", label: "Cargo", value: (o) => o.cargo_description },
    { key: "quantity", label: "Quantity", value: (o) => o.quantity },
    { key: "weight_kg", label: "Weight (kg)", value: (o) => o.weight_kg },
    { key: "amount", label: "Amount (PHP)", value: (o) => o.amount, sortKey: "amount" },
    { key: "status", label: "Status", value: (o) => ORDER_STATUS[o.status]?.label, render: (o) => <StatusBadge status={o.status} map={ORDER_STATUS} />, sortKey: "status", preset: true },
  ],
};

const maintenance: CustomSourceDef<MaintenanceRecord> = {
  label: "Maintenance",
  description: "Maintenance work, schedule, cost and provider.",
  noun: "records",
  load: maintenanceService.list,
  period: { from: "from", to: "to", label: "Work scheduled in this period." },
  status: { label: "Status", options: statusOptions(MAINTENANCE_STATUS) },
  vehicle: true,
  defaultSort: "-scheduled_date",
  fields: [
    { key: "reference_number", label: "Reference No.", value: (m) => m.reference_number, sortKey: "reference_number", preset: true },
    { key: "vehicle", label: "Vehicle", value: (m) => m.vehicle?.plate_number, preset: true },
    { key: "service_type", label: "Maintenance Type", value: (m) => labelOf(MAINTENANCE_TYPES, m.service_type), preset: true },
    { key: "category", label: "Category", value: (m) => labelOf(MAINTENANCE_CATEGORIES, m.category) },
    { key: "scheduled_date", label: "Scheduled Date", value: (m) => day(m.scheduled_date), sortKey: "scheduled_date", preset: true },
    { key: "service_date", label: "Service Date", value: (m) => day(m.service_date), sortKey: "service_date" },
    { key: "odometer_km", label: "Odometer (km)", value: (m) => m.odometer_km },
    { key: "estimated_cost", label: "Estimated Cost (PHP)", value: (m) => m.estimated_cost, sortKey: "estimated_cost" },
    { key: "actual_cost", label: "Actual Cost (PHP)", value: (m) => m.actual_cost, sortKey: "actual_cost", preset: true },
    { key: "service_provider", label: "Service Provider", value: (m) => m.service_provider },
    { key: "assigned_to", label: "Assigned To", value: (m) => m.assigned_to },
    {
      key: "status",
      label: "Status",
      value: (m) => MAINTENANCE_STATUS[m.display_status]?.label,
      render: (m) => <StatusBadge status={m.display_status} map={MAINTENANCE_STATUS} />,
      preset: true,
    },
  ],
};

const fuel: CustomSourceDef<FuelRecord> = {
  label: "Fuel Transactions",
  description: "Fuel purchases with quantity, price, station and odometer.",
  noun: "transactions",
  load: fuelService.list,
  period: { from: "from", to: "to", label: "Fuel bought in this period." },
  vehicle: true,
  driver: true,
  defaultSort: "-fueled_at",
  fields: [
    { key: "fueled_at", label: "Date & Time", value: (f) => date(f.fueled_at), sortKey: "fueled_at", preset: true },
    { key: "vehicle", label: "Vehicle", value: (f) => f.vehicle?.plate_number, preset: true },
    { key: "driver", label: "Driver", value: (f) => f.driver?.full_name, preset: true },
    { key: "fuel_type", label: "Fuel Type", value: (f) => labelOf(FUEL_TYPES, f.fuel_type) },
    { key: "liters", label: "Quantity (L)", value: (f) => f.liters, sortKey: "liters", preset: true },
    { key: "price_per_liter", label: "Unit Price (PHP)", value: (f) => f.price_per_liter, sortKey: "price_per_liter" },
    { key: "total_cost", label: "Total Cost (PHP)", value: (f) => f.total_cost, sortKey: "total_cost", preset: true },
    { key: "odometer_km", label: "Odometer (km)", value: (f) => f.odometer_km, sortKey: "odometer_km" },
    { key: "payment_method", label: "Payment Method", value: (f) => (f.payment_method ? labelOf(PAYMENT_METHODS, f.payment_method) : "") },
    { key: "station", label: "Fuel Station", value: (f) => f.station, preset: true },
    { key: "receipt_number", label: "Receipt No.", value: (f) => f.receipt_number },
    { key: "reference_number", label: "Reference No.", value: (f) => f.reference_number },
  ],
};

const drivers: CustomSourceDef<Driver> = {
  label: "Drivers",
  description: "Driver directory, licenses and current status.",
  noun: "drivers",
  load: driversService.list,
  status: { label: "Driver Status", options: statusOptions(DRIVER_STATUS) },
  defaultSort: "full_name",
  fields: [
    { key: "employee_code", label: "Employee Code", value: (d) => d.employee_code, sortKey: "employee_code", preset: true },
    { key: "full_name", label: "Name", value: (d) => d.full_name, sortKey: "full_name", preset: true },
    { key: "phone", label: "Phone", value: (d) => d.phone, preset: true },
    { key: "email", label: "Email", value: (d) => d.email },
    { key: "license_number", label: "License No.", value: (d) => d.license_number },
    { key: "license_type", label: "License Type", value: (d) => labelOf(LICENSE_TYPES, d.license_type) },
    { key: "license_expiry", label: "License Expiry", value: (d) => day(d.license_expiry), sortKey: "license_expiry", preset: true },
    { key: "date_hired", label: "Date Hired", value: (d) => day(d.date_hired) },
    { key: "assigned_vehicle", label: "Assigned Vehicle", value: (d) => d.assigned_vehicle?.plate_number },
    { key: "status", label: "Status", value: (d) => DRIVER_STATUS[d.status]?.label, render: (d) => <StatusBadge status={d.status} map={DRIVER_STATUS} />, sortKey: "status", preset: true },
  ],
};

const vehicles: CustomSourceDef<Vehicle> = {
  label: "Vehicles",
  description: "Fleet list with specifications and current status.",
  noun: "vehicles",
  load: vehiclesService.list,
  status: { label: "Vehicle Status", options: statusOptions(VEHICLE_STATUS) },
  defaultSort: "plate_number",
  fields: [
    { key: "plate_number", label: "Plate No.", value: (v) => v.plate_number, sortKey: "plate_number", preset: true },
    { key: "vehicle_type", label: "Type", value: (v) => labelOf(VEHICLE_TYPES, v.vehicle_type), preset: true },
    { key: "make", label: "Make", value: (v) => v.make, sortKey: "make", preset: true },
    { key: "model", label: "Model", value: (v) => v.model, preset: true },
    { key: "year", label: "Year", value: (v) => v.year, sortKey: "year" },
    { key: "capacity_kg", label: "Capacity (kg)", value: (v) => v.capacity_kg, sortKey: "capacity_kg" },
    { key: "fuel_type", label: "Fuel Type", value: (v) => labelOf(FUEL_TYPES, v.fuel_type) },
    { key: "odometer_km", label: "Odometer (km)", value: (v) => v.odometer_km },
    { key: "home_depot", label: "Home Depot", value: (v) => v.home_depot },
    { key: "assigned_driver", label: "Assigned Driver", value: (v) => v.assigned_driver?.full_name },
    { key: "status", label: "Status", value: (v) => VEHICLE_STATUS[v.status]?.label, render: (v) => <StatusBadge status={v.status} map={VEHICLE_STATUS} />, sortKey: "status", preset: true },
  ],
};

// Each definition is typed by its own row; the builder only passes rows back to the same definition.
export const CUSTOM_SOURCES = { trips, orders, maintenance, fuel, drivers, vehicles } as unknown as Record<CustomSource, CustomSourceDef<unknown>>;

export const CUSTOM_SOURCE_OPTIONS = (Object.keys(CUSTOM_SOURCES) as CustomSource[]).map((value) => ({ value, label: CUSTOM_SOURCES[value].label }));

export const presetColumns = (source: CustomSource) => CUSTOM_SOURCES[source].fields.filter((f) => f.preset).map((f) => f.key);
