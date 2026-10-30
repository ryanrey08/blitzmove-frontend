import type { Tone } from "@/lib/constants";
import type { Vehicle } from "@/types/api";

export const LIVE_TRACKING_PATH = "/tracking/live-tracking";
/** A position older than this counts as offline. */
export const STALE_MINUTES = 15;
/** An active trip due within this many minutes is arriving soon. */
const ARRIVING_MINUTES = 30;

export type LiveStatus = "on_route" | "arriving" | "delayed" | "idle" | "maintenance" | "offline" | "no_signal";
export type StatusGroup = "on_route" | "idle" | "maintenance" | "offline";

/**
 * Trip state comes from trip records (estimated arrival), so a vehicle on a dispatched trip is On Route even
 * before its GPS reports. Idle/Offline need a reported position; a vehicle that has never reported is No Signal.
 */
export const LIVE_STATUS: Record<LiveStatus, { label: string; tone: Tone; color: string; group: StatusGroup }> = {
  on_route: { label: "On Route", tone: "green", color: "#16a34a", group: "on_route" },
  arriving: { label: "Arriving Soon", tone: "orange", color: "#f97316", group: "on_route" },
  delayed: { label: "Delayed", tone: "amber", color: "#d97706", group: "on_route" },
  idle: { label: "Idle", tone: "blue", color: "#2563eb", group: "idle" },
  maintenance: { label: "In Maintenance", tone: "violet", color: "#7c3aed", group: "maintenance" },
  offline: { label: "Offline", tone: "red", color: "#e30613", group: "offline" },
  no_signal: { label: "No Signal", tone: "gray", color: "#98a2b3", group: "offline" },
};

export const STATUS_GROUPS: { key: StatusGroup; label: string; color: string }[] = [
  { key: "on_route", label: "On Route", color: "#16a34a" },
  { key: "idle", label: "Idle", color: "#2563eb" },
  { key: "maintenance", label: "In Maintenance", color: "#7c3aed" },
  { key: "offline", label: "Offline", color: "#e30613" },
];

export const isFresh = (v: Vehicle, now: number) => !!v.latest_location && now - new Date(v.latest_location.recorded_at).getTime() <= STALE_MINUTES * 60_000;

export function liveStatus(v: Vehicle, now: number): LiveStatus {
  if (v.active_trip) {
    const eta = new Date(v.active_trip.estimated_arrival_at).getTime();
    if (eta < now) return "delayed";
    return eta - now <= ARRIVING_MINUTES * 60_000 ? "arriving" : "on_route";
  }
  // Off the road for workshop work, per the vehicle record.
  if (v.status === "maintenance") return "maintenance";
  if (!v.latest_location) return "no_signal";
  return isFresh(v, now) ? "idle" : "offline";
}

export const driverOf = (v: Vehicle) => v.active_trip?.driver ?? v.assigned_driver ?? null;

/** Reverse-geocoded place, else coordinates; "—" without a position. */
export function locationText(v: Vehicle, place?: string) {
  const loc = v.latest_location;
  if (!loc) return null;
  return place ?? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
}

/** "1h 20m" until the given time, or null when it has passed. */
export function remaining(iso: string, now: number) {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (minutes < 0) return null;
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}
