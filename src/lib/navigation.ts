import {
  BarChart3,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Package,
  Settings,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

export interface NavLink {
  label: string;
  href: string;
  /** Modules shown in the menu but not built yet. */
  placeholder?: boolean;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  href?: string;
  items?: NavLink[];
}

export const NAVIGATION: NavGroup[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  {
    label: "Transportation",
    icon: Truck,
    items: [
      { label: "Trip Scheduling", href: "/transportation/trip-scheduling" },
      { label: "Dispatch Management", href: "/transportation/dispatch" },
      { label: "Itinerary", href: "/transportation/itinerary" },
      { label: "Route Optimization", href: "/transportation/route-optimization" },
      { label: "GPS Tracking", href: "/transportation/gps-tracking" },
    ],
  },
  { label: "Orders", icon: Package, items: [{ label: "Orders", href: "/orders" }] },
  {
    label: "Fleet & Drivers",
    icon: Users,
    items: [
      { label: "Vehicles", href: "/fleet/vehicles" },
      { label: "Drivers", href: "/fleet/drivers" },
      { label: "Fuel Management", href: "/fleet/fuel" },
      { label: "Documents", href: "/fleet/documents" },
      { label: "Maintenance", href: "/fleet/maintenance" },
      { label: "Monitoring", href: "/fleet/monitoring" },
    ],
  },
  {
    label: "Tracking",
    icon: MapPin,
    items: [
      { label: "Live Tracking", href: "/tracking/live-tracking", placeholder: true },
      { label: "Geofences", href: "/tracking/geofences", placeholder: true },
      { label: "Trip History", href: "/tracking/trip-history", placeholder: true },
      { label: "Route Payback", href: "/tracking/route-payback", placeholder: true },
    ],
  },
  {
    label: "Maintenance",
    icon: Wrench,
    items: [
      { label: "Dashboard", href: "/maintenance/dashboard", placeholder: true },
      { label: "Work Orders", href: "/maintenance/work-orders", placeholder: true },
      { label: "Preventive Maintenance", href: "/maintenance/preventive-maintenance", placeholder: true },
      { label: "Vehicle Service History", href: "/maintenance/vehicle-service-history", placeholder: true },
      { label: "Parts & Inventory", href: "/maintenance/parts-inventory", placeholder: true },
      { label: "Vendors/Service Centers", href: "/maintenance/vendors", placeholder: true },
      { label: "Maintenance Schedule", href: "/maintenance/schedule", placeholder: true },
      { label: "Maintenance Reports", href: "/maintenance/reports", placeholder: true },
      { label: "Settings", href: "/maintenance/settings", placeholder: true },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    items: [
      { label: "Overview", href: "/reports/overview", placeholder: true },
      { label: "Trip Reports", href: "/reports/trips", placeholder: true },
      { label: "Fuel Reports", href: "/reports/fuel", placeholder: true },
      { label: "Driver Reports", href: "/reports/drivers", placeholder: true },
      { label: "Maintenance Reports", href: "/reports/maintenance", placeholder: true },
      { label: "Geofence Reports", href: "/reports/geofences", placeholder: true },
      { label: "Utilization Reports", href: "/reports/utilization", placeholder: true },
      { label: "Delivery Reports", href: "/reports/deliveries", placeholder: true },
      { label: "Custom Reports", href: "/reports/custom", placeholder: true },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    items: [{ label: "Profile", href: "/settings/profile" }],
  },
];

export const PLACEHOLDER_MODULES: Record<string, NavGroup | undefined> = {
  tracking: NAVIGATION.find((g) => g.label === "Tracking"),
  maintenance: NAVIGATION.find((g) => g.label === "Maintenance"),
  reports: NAVIGATION.find((g) => g.label === "Reports"),
};
