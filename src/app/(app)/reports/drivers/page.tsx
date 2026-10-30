import type { Metadata } from "next";
import { DriverReportView } from "@/features/reports/driver-report-view";

export const metadata: Metadata = { title: "Driver Report" };

export default function Page() {
  return <DriverReportView />;
}
