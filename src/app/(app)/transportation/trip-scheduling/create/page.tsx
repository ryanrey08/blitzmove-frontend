import type { Metadata } from "next";
import { Suspense } from "react";
import { TripEditor } from "@/features/trips/trip-editor";

export const metadata: Metadata = { title: "Create New Trip" };

export default function Page() {
  return (
    <Suspense>
      <TripEditor />
    </Suspense>
  );
}
