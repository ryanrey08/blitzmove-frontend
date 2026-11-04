import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserDetail } from "@/features/users/user-detail";

export const metadata: Metadata = { title: "User Details" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <UserDetail id={id} />;
}
