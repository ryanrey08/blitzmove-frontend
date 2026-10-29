import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItineraryTripView } from "@/features/trips/itinerary-trip-view";

export const metadata: Metadata = { title: "Trip Itinerary" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <ItineraryTripView tripId={id} />;
}
