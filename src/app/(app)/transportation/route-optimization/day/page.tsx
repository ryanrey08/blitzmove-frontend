import type { Metadata } from "next";
import { RouteOptimizationDashboardView } from "@/features/trips/route-optimization-dashboard-view";

export const metadata: Metadata = { title: "Day Route Planner" };

export default function Page() {
  return <RouteOptimizationDashboardView />;
}
