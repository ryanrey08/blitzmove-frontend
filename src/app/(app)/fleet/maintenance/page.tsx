import type { Metadata } from "next";
import { Suspense } from "react";
import { MaintenanceView } from "@/features/maintenance/maintenance-view";

export const metadata: Metadata = { title: "Maintenance" };

export default function MaintenancePage() {
  return (
    <Suspense>
      <MaintenanceView />
    </Suspense>
  );
}
