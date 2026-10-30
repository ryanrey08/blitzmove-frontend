import type { Metadata } from "next";
import { DocumentEditor } from "@/features/documents/document-editor";

export const metadata: Metadata = { title: "Upload Document" };

export default async function Page({ searchParams }: { searchParams: Promise<{ owner?: string; id?: string }> }) {
  const { owner, id } = await searchParams;
  return <DocumentEditor owner={owner === "driver" ? "driver" : "vehicle"} defaultOwnerId={id && /^\d+$/.test(id) ? id : undefined} />;
}
