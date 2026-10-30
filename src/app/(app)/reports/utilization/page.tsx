import type { Metadata } from "next";
import { UtilizationReportView } from "@/features/reports/utilization-report-view";

export const metadata: Metadata = { title: "Utilization Report" };

export default function Page() {
  return <UtilizationReportView />;
}
