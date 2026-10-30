"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ClipboardList, Download, Eye, FileText, Maximize2, Pencil, Truck, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { BODY_TYPES, MAINTENANCE_CATEGORIES, MAINTENANCE_REMINDERS, MAINTENANCE_STATUS, MAINTENANCE_TYPES, VEHICLE_STATUS, VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { cn, formatCurrency, formatDate, formatFileSize, formatNumber } from "@/lib/utils";
import { api } from "@/services/api-client";
import { maintenanceService } from "@/services/resources";
import type { MaintenanceRecord } from "@/types/api";
import { DESCRIPTION_LIMIT, MAINTENANCE_PATH } from "./maintenance-editor";

type Tab = "details" | "history" | "costs" | "documents";

/** Maintenance Details side panel (reference: right-hand card of the Maintenance page). */
export function MaintenancePanel({ id, canEdit, onEdit, onClose }: { id: number; canEdit: boolean; onEdit: (r: MaintenanceRecord) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("details");
  const detail = useQuery({ queryKey: ["maintenance", id], queryFn: () => maintenanceService.get(id).then((r) => r.data) });
  const r = detail.data;

  return (
    <Card className="min-w-0 self-start">
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
          <ClipboardList className="h-5 w-5" /> Maintenance Details
        </h2>
        <div className="flex items-center gap-1">
          <Link href={`${MAINTENANCE_PATH}/${id}`} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="Open full maintenance details" title="Open full page">
            <Maximize2 className="h-4 w-4" />
          </Link>
          {canEdit && r && (
            <Button size="sm" onClick={() => onEdit(r)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="Close details">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {detail.isLoading ? (
        <LoadingState label="Loading maintenance…" />
      ) : detail.error || !r ? (
        <ErrorState message={detail.error?.message ?? "Maintenance record not found."} onRetry={() => detail.refetch()} />
      ) : (
        <div className="space-y-4 p-5">
          <VehicleSummary record={r} />
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "details", label: "Details" },
              { value: "history", label: "History" },
              { value: "costs", label: "Costs" },
              { value: "documents", label: "Documents", count: r.files?.length ?? 0 },
            ]}
          />
          {tab === "details" && <Details record={r} canEdit={canEdit} />}
          {tab === "history" && <History record={r} />}
          {tab === "costs" && <Costs record={r} />}
          {tab === "documents" && <Documents record={r} />}
        </div>
      )}
    </Card>
  );
}

export function VehicleSummary({ record: r }: { record: MaintenanceRecord }) {
  const v = r.vehicle;
  const body = v ? labelOf(BODY_TYPES, v.body_type ?? "") || labelOf(VEHICLE_TYPES, v.vehicle_type) : null;
  return (
    <div className="flex gap-4">
      {v?.cover_photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the API
        <img src={api.url(v.cover_photo)} alt={v.plate_number} className="h-28 w-36 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-28 w-36 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
          <Truck className="h-10 w-10" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xl font-bold text-ink-900">{v?.plate_number ?? "—"}</p>
          {v && <StatusBadge status={v.status} map={VEHICLE_STATUS} />}
        </div>
        <p className="truncate text-sm text-ink-700">{v ? `${v.make} ${v.model}${body ? ` (${body})` : ""}` : "—"}</p>
        <dl className="mt-2 space-y-0.5 text-sm">
          <SpecRow label="Year">{v?.year ?? "—"}</SpecRow>
          <SpecRow label="Mileage">{v?.odometer_km ? `${formatNumber(v.odometer_km)} km` : "—"}</SpecRow>
          <SpecRow label="Next Due">
            <span className={cn("font-medium", r.display_status === "overdue" && "text-red-700")}>
              {r.status === "completed" || r.status === "cancelled" ? "—" : formatDate(r.scheduled_date)}
            </span>
          </SpecRow>
        </dl>
      </div>
    </div>
  );
}

function SpecRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_0.75rem_minmax(0,1fr)]">
      <dt className="text-ink-500">{label}</dt>
      <span className="text-ink-500">:</span>
      <dd className="whitespace-nowrap text-ink-900">{children}</dd>
    </div>
  );
}

/** A read-only value styled like the form input it came from. */
function Value({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-medium text-ink-600">{label}</p>
      <div className="min-h-10 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm break-words text-ink-900">{children}</div>
    </div>
  );
}

export function Details({ record: r, canEdit }: { record: MaintenanceRecord; canEdit: boolean }) {
  const [checklist, setChecklist] = useState(r.checklist);
  const save = useApiMutation((next: MaintenanceRecord["checklist"]) => maintenanceService.patch(r.id, { checklist: next }), {
    invalidate: [["maintenance"]],
    successMessage: "Checklist updated.",
  });
  const toggle = (index: number) => {
    const next = checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c));
    setChecklist(next);
    save.mutate(next, { onError: () => setChecklist(checklist) });
  };
  const done = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-3">
          <Value label="Service Type">{labelOf(MAINTENANCE_TYPES, r.service_type)}</Value>
          <Value label="Schedule Date">{formatDate(r.scheduled_date, "MMM dd, yyyy")}</Value>
          <Value label="Assigned To">{r.assigned_to || r.service_provider || "—"}</Value>
          <Value label="Estimated Cost">{formatCurrency(r.estimated_cost)}</Value>
          <div>
            <p className="mb-1 text-xs font-medium text-ink-600">Status</p>
            <StatusBadge status={r.display_status} map={MAINTENANCE_STATUS} />
          </div>
        </div>
        <div className="space-y-3">
          <Value label="Description">
            <p className="min-h-24 whitespace-pre-line">{r.description || "—"}</p>
            <p className="mt-1 text-right text-xs text-ink-500">
              {r.description?.length ?? 0}/{DESCRIPTION_LIMIT}
            </p>
          </Value>
          <Value label="Reminder">{r.reminder_days ? labelOf(MAINTENANCE_REMINDERS, String(r.reminder_days)) : "No reminder"}</Value>
          <Value label="Category">{labelOf(MAINTENANCE_CATEGORIES, r.category)}</Value>
          <Value label="Reference No.">{r.reference_number}</Value>
        </div>
        {r.service_provider && r.assigned_to && (
          <Value label="Service Provider" className="sm:col-span-2">
            {r.service_provider}
          </Value>
        )}
      </div>

      <section className="border-t border-ink-100 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <ClipboardCheck className="h-4 w-4" /> Service Checklist
          </h3>
          {checklist.length > 0 && (
            <span className="text-xs text-ink-500">
              {done}/{checklist.length} done
            </span>
          )}
        </div>
        {checklist.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {checklist.map((c, i) => (
              <label key={`${c.item}-${i}`} className={cn("flex items-center gap-2 text-sm text-ink-700", canEdit && "cursor-pointer")}>
                <input type="checkbox" className="h-4 w-4 rounded border-ink-300 accent-brand-600" checked={c.done} disabled={!canEdit || save.isPending} onChange={() => toggle(i)} />
                {c.item}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500">No checklist for this service.</p>
        )}
      </section>
      {r.notes && <Value label="Notes / Remarks">{<p className="whitespace-pre-line">{r.notes}</p>}</Value>}
    </div>
  );
}

export function History({ record: r }: { record: MaintenanceRecord }) {
  const history = useQuery({
    queryKey: ["maintenance", "history", r.vehicle_id],
    queryFn: () => maintenanceService.list({ vehicle_id: r.vehicle_id, per_page: 15, sort: "-scheduled_date" }),
  });
  if (history.isLoading) return <LoadingState label="Loading history…" />;
  if (history.error) return <ErrorState message={history.error.message} onRetry={() => history.refetch()} />;
  const rows = history.data?.data ?? [];
  if (!rows.length) return <p className="text-sm text-ink-500">No maintenance history for this vehicle.</p>;

  return (
    <ol className="space-y-3">
      {rows.map((h) => (
        <li key={h.id} className={cn("rounded-lg border px-3 py-2.5", h.id === r.id ? "border-brand-200 bg-brand-50/40" : "border-ink-100")}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-900">{labelOf(MAINTENANCE_TYPES, h.service_type)}</p>
              <p className="text-xs text-ink-500">
                {h.reference_number} · {h.status === "completed" ? `Done ${formatDate(h.service_date)}` : `Due ${formatDate(h.scheduled_date)}`}
              </p>
            </div>
            <StatusBadge status={h.display_status} map={MAINTENANCE_STATUS} dot={false} />
          </div>
          {(h.actual_cost ?? h.estimated_cost) !== null && (
            <p className="mt-1 text-xs text-ink-600">
              {h.actual_cost !== null ? "Cost" : "Estimate"}: {formatCurrency(h.actual_cost ?? h.estimated_cost)}
              {h.odometer_km ? ` · ${formatNumber(h.odometer_km)} km` : ""}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function Costs({ record: r }: { record: MaintenanceRecord }) {
  const variance = r.actual_cost !== null && r.estimated_cost !== null ? r.actual_cost - r.estimated_cost : null;
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3">
        <Value label="Estimated Cost">{formatCurrency(r.estimated_cost)}</Value>
        <Value label="Actual Cost">{formatCurrency(r.actual_cost)}</Value>
        <Value label="Parts Total">{formatCurrency(r.parts_total)}</Value>
        <Value label="Variance">
          {variance === null ? "—" : <span className={variance > 0 ? "text-red-700" : "text-emerald-700"}>{`${variance > 0 ? "+" : ""}${formatCurrency(variance)}`}</span>}
        </Value>
      </dl>
      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink-900">Parts &amp; Materials</h3>
        {r.parts.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs text-ink-500">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Item</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Qty</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Unit Cost</th>
                  <th className="py-1.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {r.parts.map((p, i) => (
                  <tr key={`${p.name}-${i}`}>
                    <td className="py-1.5 pr-3">{p.name}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{formatNumber(p.quantity)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{formatNumber(p.unit_cost, 2)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatNumber(p.quantity * p.unit_cost, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-500">No parts recorded.</p>
        )}
      </section>
    </div>
  );
}

export function Documents({ record: r }: { record: MaintenanceRecord }) {
  const files = r.files ?? [];
  if (!files.length) return <p className="text-sm text-ink-500">No receipts or documents attached. Add them from Edit.</p>;
  return (
    <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{f.original_name}</p>
            <p className="text-xs text-ink-500">
              {formatFileSize(f.file_size)} · {formatDate(f.created_at)}
            </p>
          </div>
          <a href={maintenanceService.fileUrl(f)} target="_blank" rel="noopener" className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`View ${f.original_name}`}>
            <Eye className="h-4 w-4" />
          </a>
          <a href={maintenanceService.fileUrl(f, true)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Download ${f.original_name}`}>
            <Download className="h-4 w-4" />
          </a>
        </li>
      ))}
    </ul>
  );
}
