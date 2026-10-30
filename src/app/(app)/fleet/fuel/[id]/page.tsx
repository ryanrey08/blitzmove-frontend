import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FuelDetail } from "@/features/fuel/fuel-detail";

export const metadata: Metadata = { title: "Fuel Transaction" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <FuelDetail id={id} />;
}
