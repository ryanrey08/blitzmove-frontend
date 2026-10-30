import type { Metadata } from "next";
import { DeliveryReportView } from "@/features/reports/delivery-report-view";

export const metadata: Metadata = { title: "Delivery Report" };

export default function Page() {
  return <DeliveryReportView />;
}
