import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VehicleEditor } from "@/features/vehicles/vehicle-editor";

export const metadata: Metadata = { title: "Edit Vehicle" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <VehicleEditor vehicleId={id} />;
}
