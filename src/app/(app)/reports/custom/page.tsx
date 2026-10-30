import type { Metadata } from "next";
import { CustomReportView } from "@/features/reports/custom-report-view";

export const metadata: Metadata = { title: "Custom Report" };

export default function Page() {
  return <CustomReportView />;
}
