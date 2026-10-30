import { redirect } from "next/navigation";

/** /fleet-maintenance[/...] → /fleet/maintenance[/...] (Fleet & Drivers pages live under /fleet). */
export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  redirect(["/fleet/maintenance", ...slug.map(encodeURIComponent)].join("/"));
}
