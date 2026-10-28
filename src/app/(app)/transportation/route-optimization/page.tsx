import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteOptimizationView } from "@/features/trips/route-optimization-view";

export const metadata: Metadata = { title: "Route Optimization" };

export default function Page() {
  return (
    <Suspense>
      <RouteOptimizationView />
    </Suspense>
  );
}
