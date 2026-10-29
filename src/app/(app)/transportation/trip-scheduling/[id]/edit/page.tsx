import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TripEditor } from "@/features/trips/trip-editor";

export const metadata: Metadata = { title: "Edit Trip" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (
    <Suspense>
      <TripEditor tripId={id} />
    </Suspense>
  );
}
