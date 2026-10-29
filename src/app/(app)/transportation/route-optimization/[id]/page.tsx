import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteOptimizationTripView } from "@/features/trips/route-optimization-trip-view";

export const metadata: Metadata = { title: "Route Plan" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <RouteOptimizationTripView tripId={id} />;
}
