import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MaintenanceEditor } from "@/features/maintenance/maintenance-editor";

export const metadata: Metadata = { title: "Edit Maintenance" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <MaintenanceEditor recordId={id} />;
}
