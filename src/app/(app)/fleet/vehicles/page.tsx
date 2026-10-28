import type { Metadata } from "next";
import { VehiclesView } from "@/features/vehicles/vehicles-view";

export const metadata: Metadata = { title: "Vehicles" };

export default function VehiclesPage() {
  return <VehiclesView />;
}
