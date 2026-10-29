import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ItineraryView } from "@/features/trips/itinerary-view";

export const metadata: Metadata = { title: "Itinerary" };

export default async function Page({ searchParams }: { searchParams: Promise<{ trip?: string }> }) {
  // Old links (`/transportation/itinerary?trip=12`) open the trip's itinerary page.
  const trip = Number((await searchParams).trip);
  if (Number.isInteger(trip) && trip > 0) redirect(`/transportation/itinerary/${trip}`);

  return (
    <Suspense>
      <ItineraryView />
    </Suspense>
  );
}
