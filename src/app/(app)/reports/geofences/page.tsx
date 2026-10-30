import type { Metadata } from "next";
import { GeofenceReportView } from "@/features/reports/geofence-report-view";

export const metadata: Metadata = { title: "Geofence Report" };

export default function Page() {
  return <GeofenceReportView />;
}
