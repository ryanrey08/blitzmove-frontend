import type { Metadata } from "next";
import { VehicleEditor } from "@/features/vehicles/vehicle-editor";

export const metadata: Metadata = { title: "Add Vehicle" };

export default function Page() {
  return <VehicleEditor />;
}
