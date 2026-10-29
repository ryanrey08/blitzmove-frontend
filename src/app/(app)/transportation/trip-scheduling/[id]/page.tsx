import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TripDetail } from "@/features/trips/trip-detail";

export const metadata: Metadata = { title: "Trip details" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <TripDetail id={id} />;
}
