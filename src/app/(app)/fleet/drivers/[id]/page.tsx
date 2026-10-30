import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverDetail } from "@/features/drivers/driver-detail";

export const metadata: Metadata = { title: "Driver details" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <DriverDetail id={id} />;
}
