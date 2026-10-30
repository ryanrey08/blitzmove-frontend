import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FuelEditor } from "@/features/fuel/fuel-editor";

export const metadata: Metadata = { title: "Edit Fuel Transaction" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <FuelEditor recordId={id} />;
}
