import type { Metadata } from "next";
import { Suspense } from "react";
import { DispatchView } from "@/features/trips/dispatch-view";

export const metadata: Metadata = { title: "Dispatch Management" };

export default function Page() {
  return (
    <Suspense>
      <DispatchView />
    </Suspense>
  );
}
