import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentEditor } from "@/features/documents/document-editor";

export const metadata: Metadata = { title: "Edit Document" };

export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
  const { owner, id: rawId } = await params;
  const id = Number(rawId);
  if ((owner !== "vehicle" && owner !== "driver") || !Number.isInteger(id) || id <= 0) notFound();
  return <DocumentEditor owner={owner} documentId={id} />;
}
