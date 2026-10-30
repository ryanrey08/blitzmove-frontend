import type { Metadata } from "next";
import { FuelEditor } from "@/features/fuel/fuel-editor";

export const metadata: Metadata = { title: "Add Fuel Transaction" };

export default async function Page({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  const { vehicle } = await searchParams;
  return <FuelEditor defaultVehicleId={vehicle && /^\d+$/.test(vehicle) ? vehicle : undefined} />;
}
