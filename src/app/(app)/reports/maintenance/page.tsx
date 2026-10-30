import type { Metadata } from "next";
import { MaintenanceReportView } from "@/features/reports/maintenance-report-view";

export const metadata: Metadata = { title: "Maintenance Report" };

export default function Page() {
  return <MaintenanceReportView />;
}
