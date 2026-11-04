import {
  BarChart3,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Package,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

/** A permission slug, or a list of which any one is enough. */
export type Permission = string | readonly string[];

export interface NavLink {
  label: string;
  href: string;
  /** Modules shown in the menu but not built yet. */
  placeholder?: boolean;
  /** Left out of the sidebar; the route still works. */
  hidden?: boolean;
  /** Shown only to users holding this permission (or any of these). */
  permission?: Permission;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  href?: string;
  items?: NavLink[];
  /** Left out of the sidebar along with its items; the routes still work. */
  hidden?: boolean;
  /** For single-link groups: shown only to users holding this permission. */
  permission?: Permission;
}

const TRIP_READERS = ["trips.view", "trips.view_assigned"];

export const NAVIGATION: NavGroup[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", permission: "dashboard.view" },
  {
    label: "Transportation",
    icon: Truck,
    items: [
      { label: "Trip Scheduling", href: "/transportation/trip-scheduling", permission: TRIP_READERS },
      { label: "Dispatch Management", href: "/transportation/dispatch", permission: "dispatch.view" },
      { label: "Itinerary", href: "/transportation/itinerary", permission: TRIP_READERS },
      { label: "Route Optimization", href: "/transportation/route-optimization", permission: "trips.view" },
      { label: "GPS Tracking", href: "/transportation/gps-tracking", permission: "tracking.view" },
    ],
  },
  { label: "Orders", icon: Package, items: [{ label: "Orders", href: "/orders", permission: "orders.view" }] },
  {
    label: "Fleet & Drivers",
    icon: Users,
    items: [
      { label: "Vehicles", href: "/fleet/vehicles", permission: "vehicles.view" },
      { label: "Drivers", href: "/fleet/drivers", permission: "drivers.view" },
      { label: "Fuel Management", href: "/fleet/fuel", permission: "fuel.view" },
      { label: "Maintenance", href: "/fleet/maintenance", permission: "maintenance.view" },
      { label: "Documents", href: "/fleet/documents", permission: "documents.view" },
      { label: "Monitoring", href: "/fleet/monitoring", permission: "tracking.monitor" },
    ],
  },
  {
    label: "Tracking",
    icon: MapPin,
    items: [
      { label: "Live Tracking", href: "/tracking/live-tracking", permission: "tracking.view" },
      { label: "Geofences", href: "/tracking/geofences", placeholder: true, hidden: true },
      { label: "Trip History", href: "/tracking/trip-history", placeholder: true, hidden: true },
      { label: "Route Payback", href: "/tracking/route-payback", placeholder: true, hidden: true },
    ],
  },
  {
    label: "Maintenance",
    icon: Wrench,
    hidden: true,
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
      { label: "Overview", href: "/reports/overview", permission: "reports.view" },
      { label: "Trip Reports", href: "/reports/trips", permission: "reports.view" },
      { label: "Fuel Reports", href: "/reports/fuel", permission: "reports.view" },
      { label: "Driver Reports", href: "/reports/drivers", permission: "reports.view" },
      { label: "Maintenance Reports", href: "/reports/maintenance", permission: "reports.view" },
      { label: "Geofence Reports", href: "/reports/geofences", permission: "reports.view" },
      { label: "Utilization Reports", href: "/reports/utilization", permission: "reports.view" },
      { label: "Delivery Reports", href: "/reports/deliveries", permission: "reports.view" },
      { label: "Custom Reports", href: "/reports/custom", permission: "reports.view" },
    ],
  },
  {
    label: "User Management",
    icon: ShieldCheck,
    items: [
      { label: "Users", href: "/user-management/users", permission: "users.view" },
      { label: "Roles & Permissions", href: "/user-management/roles", permission: "roles.view" },
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

/**
 * Page-level access, checked in order (first match wins). Paths with no rule
 * (Settings → Profile) are open to every signed-in user. The API enforces the
 * same permissions on every request; this only decides what the UI renders.
 */
export const ROUTE_PERMISSIONS: [RegExp, Permission][] = [
  [/^\/dashboard/, "dashboard.view"],
  [/^\/transportation\/trip-scheduling\/create/, "trips.create"],
  [/^\/transportation\/trip-scheduling\/\d+\/edit/, "trips.update"],
  [/^\/transportation\/trip-scheduling/, ["trips.view", "trips.view_assigned", "dispatch.view"]],
  [/^\/transportation\/dispatch\/create/, "dispatch.update"],
  [/^\/transportation\/dispatch/, "dispatch.view"],
  [/^\/transportation\/itinerary/, TRIP_READERS],
  [/^\/transportation\/route-optimization/, "trips.view"],
  [/^\/transportation\/gps-tracking/, "tracking.view"],
  [/^\/orders/, "orders.view"],
  [/^\/fleet\/vehicles\/create/, "vehicles.create"],
  [/^\/fleet\/vehicles\/\d+\/edit/, "vehicles.update"],
  [/^\/fleet\/vehicles/, "vehicles.view"],
  [/^\/fleet\/drivers\/create/, "drivers.create"],
  [/^\/fleet\/drivers\/\d+\/edit/, "drivers.update"],
  [/^\/fleet\/drivers/, "drivers.view"],
  [/^\/fleet\/fuel\/create/, "fuel.create"],
  [/^\/fleet\/fuel\/\d+\/edit/, "fuel.update"],
  [/^\/fleet\/fuel/, "fuel.view"],
  [/^\/fleet\/maintenance\/create/, "maintenance.create"],
  [/^\/fleet\/maintenance\/\d+\/edit/, "maintenance.update"],
  [/^\/fleet\/maintenance/, "maintenance.view"],
  [/^\/fleet\/documents\/upload/, "documents.create"],
  [/^\/fleet\/documents\/[a-z]+\/\d+\/edit/, "documents.update"],
  [/^\/fleet\/documents/, "documents.view"],
  [/^\/fleet\/monitoring/, "tracking.monitor"],
  [/^\/tracking/, "tracking.view"],
  [/^\/maintenance/, "maintenance.view"],
  [/^\/reports/, "reports.view"],
  [/^\/user-management\/users\/create/, "users.create"],
  [/^\/user-management\/users\/\d+\/edit/, "users.update"],
  [/^\/user-management\/users/, "users.view"],
  [/^\/user-management\/roles\/create/, "roles.create"],
  [/^\/user-management\/roles\/\d+\/edit/, ["roles.update", "roles.assign_permissions"]],
  [/^\/user-management\/roles/, "roles.view"],
];

export function routePermission(pathname: string): Permission | undefined {
  return ROUTE_PERMISSIONS.find(([pattern]) => pattern.test(pathname))?.[1];
}

type Can = (permission: Permission) => boolean;

/** The sidebar as this user may see it: hidden and unauthorized links removed, empty groups dropped. */
export function visibleNavigation(can: Can): NavGroup[] {
  return NAVIGATION.filter((group) => !group.hidden)
    .map((group) => (group.items ? { ...group, items: group.items.filter((item) => !item.hidden && (!item.permission || can(item.permission))) } : group))
    .filter((group) => (group.items ? group.items.length > 0 : !group.permission || can(group.permission)));
}

/** Where to land a user who may not open the dashboard: their first permitted page. */
export function homePath(can: Can): string {
  for (const group of visibleNavigation(can)) {
    const href = group.href ?? group.items?.find((item) => !item.placeholder)?.href;
    if (href) return href;
  }
  return "/settings/profile";
}
