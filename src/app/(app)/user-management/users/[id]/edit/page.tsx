import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserEditor } from "@/features/users/user-editor";

export const metadata: Metadata = { title: "Edit User" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <UserEditor userId={id} />;
}
