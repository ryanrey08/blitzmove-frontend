import type { Metadata } from "next";
import { ReportsOverviewView } from "@/features/reports/reports-overview-view";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <ReportsOverviewView />;
}
