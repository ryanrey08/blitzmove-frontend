import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RouteOptimizationView } from "@/features/trips/route-optimization-view";

export const metadata: Metadata = { title: "Route Optimization" };

export default async function Page({ searchParams }: { searchParams: Promise<{ trip?: string }> }) {
  // Old links (`/transportation/route-optimization?trip=12`) open the trip's route plan.
  const trip = Number((await searchParams).trip);
  if (Number.isInteger(trip) && trip > 0) redirect(`/transportation/route-optimization/${trip}`);

  return (
    <Suspense>
      <RouteOptimizationView />
    </Suspense>
  );
}
