import type { Metadata } from "next";
import { Suspense } from "react";
import { DispatchTripView } from "@/features/trips/dispatch-trip-view";

export const metadata: Metadata = { title: "Dispatch Trip" };

export default function Page() {
  return (
    <Suspense>
      <DispatchTripView />
    </Suspense>
  );
}
