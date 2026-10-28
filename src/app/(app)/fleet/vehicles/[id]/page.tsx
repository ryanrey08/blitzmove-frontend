import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VehicleDetail } from "@/features/vehicles/vehicle-detail";

export const metadata: Metadata = { title: "Vehicle details" };

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <VehicleDetail id={id} />;
}
