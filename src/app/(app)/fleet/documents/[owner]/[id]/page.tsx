import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentDetail } from "@/features/documents/document-detail";

export const metadata: Metadata = { title: "Document Details" };

export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
  const { owner, id: rawId } = await params;
  const id = Number(rawId);
  if ((owner !== "vehicle" && owner !== "driver") || !Number.isInteger(id) || id <= 0) notFound();
  return <DocumentDetail owner={owner} id={id} />;
}
