import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DispatchTripView } from "@/features/trips/dispatch-trip-view";

export const metadata: Metadata = { title: "Dispatch Trip" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <DispatchTripView tripId={id} />;
}
