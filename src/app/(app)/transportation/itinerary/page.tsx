import type { Metadata } from "next";
import { Suspense } from "react";
import { ItineraryView } from "@/features/trips/itinerary-view";

export const metadata: Metadata = { title: "Itinerary" };

export default function Page() {
  return (
    <Suspense>
      <ItineraryView />
    </Suspense>
  );
}
