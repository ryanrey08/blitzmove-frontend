import { ShieldAlert } from "lucide-react";
import Link from "next/link";

/** 403 screen for pages (or actions) the signed-in user's role does not allow. */
export function AccessDenied({ homeHref = "/dashboard", message }: { homeHref?: string; message?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <ShieldAlert className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-semibold text-brand-600">403 · Access denied</p>
      <h1 className="mt-1 text-2xl font-bold text-ink-900">You don&apos;t have access to this page</h1>
      <p className="mt-2 max-w-md text-ink-500">
        {message ?? "Your role does not include permission to open it. If you need access, ask an administrator to update your role."}
      </p>
      <Link href={homeHref} className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        Go to my home page
      </Link>
    </div>
  );
}
