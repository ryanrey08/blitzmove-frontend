import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MaintenanceDetail } from "@/features/maintenance/maintenance-detail";

export const metadata: Metadata = { title: "Maintenance Details" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <MaintenanceDetail id={id} />;
}
