import type { Metadata } from "next";
import { Suspense } from "react";
import { FuelView } from "@/features/fuel/fuel-view";

export const metadata: Metadata = { title: "Fuel Management" };

export default function FuelPage() {
  return (
    <Suspense>
      <FuelView />
    </Suspense>
  );
}
