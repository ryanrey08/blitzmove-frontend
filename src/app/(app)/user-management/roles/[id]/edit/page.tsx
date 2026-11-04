import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleEditor } from "@/features/roles/role-editor";

export const metadata: Metadata = { title: "Edit Role" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <RoleEditor roleId={id} />;
}
