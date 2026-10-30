import type { Metadata } from "next";
import { MaintenanceEditor } from "@/features/maintenance/maintenance-editor";

export const metadata: Metadata = { title: "Add Maintenance" };

export default async function Page({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  const { vehicle } = await searchParams;
  return <MaintenanceEditor defaultVehicleId={vehicle && /^\d+$/.test(vehicle) ? vehicle : undefined} />;
}
