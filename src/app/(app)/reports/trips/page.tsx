import type { Metadata } from "next";
import { TripReportView } from "@/features/reports/trip-report-view";

export const metadata: Metadata = { title: "Trip Report" };

export default function Page() {
  return <TripReportView />;
}
