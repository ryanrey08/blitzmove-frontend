import { Construction } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PLACEHOLDER_MODULES } from "@/lib/navigation";

/** Landing page for sidebar modules that are planned but not built yet. */
export function ModulePlaceholder({ module, slug }: { module: string; slug: string[] }) {
  const group = PLACEHOLDER_MODULES[module];
  const href = `/${module}/${slug.join("/")}`;
  const item = group?.items?.find((i) => i.href === href);
  if (!group || (slug.length && !item)) notFound();

  const Icon = group.icon;
  return (
    <Card className="mx-auto mt-6 max-w-2xl">
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon className="h-7 w-7" />
        </span>
        <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">{group.label}</p>
        <h1 className="mt-1 text-2xl font-bold text-ink-900">{item?.label ?? group.label}</h1>
        <p className="mt-3 flex max-w-md items-center gap-2 text-ink-600">
          <Construction className="h-4 w-4 shrink-0" /> This module is planned and not available yet.
        </p>
        <p className="mt-2 max-w-md text-sm text-ink-500">
          Live data for {group.label.toLowerCase()} is not part of the current release. Operational data is available under Transportation, Orders and Fleet &amp; Drivers.
        </p>
        <Link href="/dashboard" className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Back to dashboard
        </Link>
      </div>
    </Card>
  );
}
