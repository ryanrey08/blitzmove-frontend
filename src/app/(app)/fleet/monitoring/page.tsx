import type { Metadata } from "next";
import { MonitoringView } from "@/features/monitoring/monitoring-view";

export const metadata: Metadata = { title: "Fleet Monitoring" };

export default function MonitoringPage() {
  return <MonitoringView />;
}
