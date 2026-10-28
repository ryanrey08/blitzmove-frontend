import type { Metadata } from "next";
import { Suspense } from "react";
import { GpsTrackingView } from "@/features/trips/gps-tracking-view";

export const metadata: Metadata = { title: "GPS Tracking" };

export default function Page() {
  return (
    <Suspense>
      <GpsTrackingView />
    </Suspense>
  );
}
