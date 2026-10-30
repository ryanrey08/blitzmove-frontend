import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModulePlaceholder } from "@/features/placeholder/module-placeholder";

export const metadata: Metadata = { title: "Coming soon" };

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const slug = (await params).slug ?? [];
  // /reports opens the Overview; the other report pages are still placeholders.
  if (!slug.length) redirect("/reports/overview");
  return <ModulePlaceholder module="reports" slug={slug} />;
}
