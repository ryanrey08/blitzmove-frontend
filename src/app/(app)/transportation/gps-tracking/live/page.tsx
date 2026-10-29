import type { Metadata } from "next";
import { GpsDashboardView } from "@/features/trips/gps-dashboard-view";

export const metadata: Metadata = { title: "GPS Live Map" };

export default function Page() {
  return <GpsDashboardView />;
}
