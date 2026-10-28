import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/session";

// Every authenticated page validates the session token with the API.
export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/api/auth/session-expired?next=${encodeURIComponent(path)}`);
  }

  return <AppShell user={user}>{children}</AppShell>;
}
