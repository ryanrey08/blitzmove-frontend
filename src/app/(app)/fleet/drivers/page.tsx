import type { Metadata } from "next";
import { Suspense } from "react";
import { DriversView } from "@/features/drivers/drivers-view";

export const metadata: Metadata = { title: "Drivers" };

export default function DriversPage() {
  return (
    <Suspense>
      <DriversView />
    </Suspense>
  );
}
