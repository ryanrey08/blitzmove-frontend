import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GpsVehicleView } from "@/features/trips/gps-vehicle-view";

export const metadata: Metadata = { title: "Vehicle Tracking" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <GpsVehicleView vehicleId={id} />;
}
