import { redirect } from "next/navigation";

/** Dispatching now starts from a trip in the Dispatch Management table; keep old links working. */
export default async function Page({ searchParams }: { searchParams: Promise<{ trip?: string }> }) {
  const trip = Number((await searchParams).trip);
  redirect(Number.isInteger(trip) && trip > 0 ? `/transportation/dispatch/${trip}` : "/transportation/dispatch?status=scheduled");
}
