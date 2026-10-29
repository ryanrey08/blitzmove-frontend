import type { Metadata } from "next";
import { TripScheduleView } from "@/features/trips/trip-schedule-view";

export const metadata: Metadata = { title: "Trip Scheduling" };

export default function Page() {
  return <TripScheduleView />;
}
