import type { Metadata } from "next";
import { ModulePlaceholder } from "@/features/placeholder/module-placeholder";

export const metadata: Metadata = { title: "Coming soon" };

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  return <ModulePlaceholder module="reports" slug={(await params).slug ?? []} />;
}
