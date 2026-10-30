import type { Metadata } from "next";
import { FuelReportView } from "@/features/reports/fuel-report-view";

export const metadata: Metadata = { title: "Fuel Report" };

export default function Page() {
  return <FuelReportView />;
}
