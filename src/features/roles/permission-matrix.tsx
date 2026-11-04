"use client";

import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PermissionItem, PermissionModule } from "@/types/api";

/** Standard CRUD columns; any other action of a module is listed under "Other". */
const COLUMNS = [
  { action: "view", label: "View" },
  { action: "create", label: "Create" },
  { action: "update", label: "Edit" },
  { action: "delete", label: "Delete" },
] as const;
const STANDARD = new Set<string>(COLUMNS.map((c) => c.action));
const actionOf = (p: PermissionItem) => p.action ?? p.slug.split(".").slice(1).join(".");

function Box({ checked, disabled, onChange, label, title }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string; title?: string }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm", disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer")} title={title}>
      <input type="checkbox" className="h-4 w-4 rounded border-ink-300 accent-brand-600" checked={checked} disabled={disabled} onChange={onChange} aria-label={label} />
    </label>
  );
}

/**
 * Role permissions grouped by module, built from GET /admin/permissions. `selected` holds
 * permission slugs; `grantable` (when given) limits what this user may tick.
 */
export function PermissionMatrix({
  modules,
  selected,
  onChange,
  readOnly,
  grantable,
}: {
  modules: PermissionModule[];
  selected: Set<string>;
  onChange?: (next: Set<string>) => void;
  readOnly?: boolean;
  grantable?: (slug: string) => boolean;
}) {
  const can = (slug: string) => !readOnly && (!grantable || grantable(slug) || selected.has(slug));
  const toggle = (slug: string) => {
    if (!onChange || !can(slug)) return;
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onChange(next);
  };
  const setModule = (module: PermissionModule, on: boolean) => {
    if (!onChange) return;
    const next = new Set(selected);
    for (const p of module.permissions) {
      if (on && can(p.slug) && (!grantable || grantable(p.slug))) next.add(p.slug);
      if (!on && can(p.slug)) next.delete(p.slug);
    }
    onChange(next);
  };
  const total = modules.reduce((n, m) => n + m.permissions.length, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3 text-sm">
        <span className="text-ink-600">
          <strong className="text-ink-900">{selected.size}</strong> of {total} permissions selected
        </span>
        {grantable && !readOnly && <span className="text-xs text-ink-500">Permissions you don&apos;t hold yourself can&apos;t be granted.</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
            <tr>
              <th className="px-5 py-3">Module</th>
              {COLUMNS.map((c) => (
                <th key={c.action} className="px-3 py-3 text-center">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-3">Other</th>
              {!readOnly && <th className="px-5 py-3 text-right">Module</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {modules.map((m) => {
              const byAction = new Map(m.permissions.map((p) => [actionOf(p), p]));
              const extras = m.permissions.filter((p) => !STANDARD.has(actionOf(p)));
              const count = m.permissions.filter((p) => selected.has(p.slug)).length;
              return (
                <tr key={m.module} className="align-top">
                  <td className="px-5 py-3">
                    <span className="block font-semibold text-ink-900">{m.label}</span>
                    <span className="text-xs text-ink-500">
                      {count}/{m.permissions.length} selected
                    </span>
                  </td>
                  {COLUMNS.map((c) => {
                    const p = byAction.get(c.action);
                    return (
                      <td key={c.action} className="px-3 py-3 text-center">
                        {p ? (
                          <Box checked={selected.has(p.slug)} disabled={!can(p.slug)} onChange={() => toggle(p.slug)} label={`${m.label}: ${c.label}`} title={p.description ?? p.slug} />
                        ) : (
                          <Minus className="mx-auto h-4 w-4 text-ink-300" aria-label="Not applicable" />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1.5">
                      {extras.map((p) => (
                        <label key={p.slug} className={cn("inline-flex items-center gap-2 text-sm text-ink-700", can(p.slug) ? "cursor-pointer" : "cursor-not-allowed opacity-70")} title={p.description ?? p.slug}>
                          <input type="checkbox" className="h-4 w-4 rounded border-ink-300 accent-brand-600" checked={selected.has(p.slug)} disabled={!can(p.slug)} onChange={() => toggle(p.slug)} />
                          {p.name.split(": ").pop()}
                        </label>
                      ))}
                      {extras.length === 0 && <span className="text-ink-300">—</span>}
                    </div>
                  </td>
                  {!readOnly && (
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => setModule(m, true)} className="text-xs font-medium text-brand-600 hover:underline">
                        Select all
                      </button>
                      <span className="mx-1.5 text-ink-300">|</span>
                      <button type="button" onClick={() => setModule(m, false)} className="text-xs font-medium text-ink-600 hover:underline">
                        Clear
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Compact read-only list of a role's permissions for detail pages. */
export function PermissionSummary({ modules, selected }: { modules: PermissionModule[]; selected: Set<string> }) {
  return (
    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => {
        const granted = m.permissions.filter((p) => selected.has(p.slug));
        return (
          <div key={m.module}>
            <p className="mb-1.5 flex items-center justify-between text-xs font-semibold tracking-wide text-ink-500 uppercase">
              {m.label}
              <Badge tone={granted.length ? "green" : "gray"}>
                {granted.length}/{m.permissions.length}
              </Badge>
            </p>
            <ul className="space-y-1">
              {m.permissions.map((p) => (
                <li key={p.slug} className={cn("flex items-center gap-2 text-sm", selected.has(p.slug) ? "text-ink-800" : "text-ink-400")} title={p.description ?? p.slug}>
                  {selected.has(p.slug) ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Minus className="h-3.5 w-3.5" />}
                  {p.name.split(": ").pop()}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
