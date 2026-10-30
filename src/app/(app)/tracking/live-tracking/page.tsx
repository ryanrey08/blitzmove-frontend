import type { Metadata } from "next";
import { LiveTrackingView } from "@/features/tracking/live-tracking-view";

export const metadata: Metadata = { title: "Live Tracking" };

export default function Page() {
  return <LiveTrackingView />;
}
