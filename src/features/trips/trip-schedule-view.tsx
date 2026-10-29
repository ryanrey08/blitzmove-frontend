"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { TRIP_PRIORITY, TRIP_STATUS, TRIP_TYPES, labelOf, statusOptions } from "@/lib/constants";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { driversService, tripsService, vehiclesService } from "@/services/resources";
import type { Trip } from "@/types/api";
import { TRIP_KEYS } from "./use-trip";

export const TRIPS_PATH = "/transportation/trip-scheduling";

/** Trips can only be edited while they are still scheduled (see TripService::update). */
export const isEditable = (trip: Pick<Trip, "status">) => trip.status === "scheduled";
/** Trips on the road must be completed before they can be deleted. */
export const isDeletable = (trip: Pick<Trip, "status">) => trip.status !== "in_progress";

function When({ value }: { value: string | null }) {
  if (!value) return <span className="text-ink-400">—</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="block text-ink-900">{formatDate(value)}</span>
      <span className="text-xs text-ink-500">{formatTime(value)}</span>
    </span>
  );
}

function IconAction({ label, onClick, href, danger, disabled, children }: { label: string; onClick?: () => void; href?: string; danger?: boolean; disabled?: boolean; children: React.ReactNode }) {
  const className = cn(
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition [&>svg]:h-4 [&>svg]:w-4",
    danger ? "hover:bg-brand-50 hover:text-brand-700" : "hover:bg-ink-100 hover:text-ink-900",
    disabled && "pointer-events-none opacity-40",
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={className} aria-label={label} title={label}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className} aria-label={label} title={label}>
      {children}
    </button>
  );
}

export function TripScheduleView() {
  const router = useRouter();
  const { canOperate } = usePermissions();
  const { params, update, setPage } = useListParams({ sort: "-departure_at", status: "", vehicle_id: "", driver_id: "", from: "", to: "" });
  const [deleting, setDeleting] = useState<Trip | null>(null);

  const list = useQuery({ queryKey: ["trips", params], queryFn: () => tripsService.list(params), placeholderData: keepPreviousData });
  const vehicles = useQuery({ queryKey: ["vehicles", "options"], queryFn: () => vehiclesService.list({ per_page: 100, sort: "plate_number" }), staleTime: 60_000 });
  const drivers = useQuery({ queryKey: ["drivers", "options"], queryFn: () => driversService.list({ per_page: 100, sort: "full_name" }), staleTime: 60_000 });

  const remove = useApiMutation(() => tripsService.remove(deleting!.id), { invalidate: TRIP_KEYS, onSuccess: () => setDeleting(null) });

  const filtered = ["status", "vehicle_id", "driver_id", "from", "to", "search"].some((k) => params[k]);
  const clearFilters = () => update({ status: "", vehicle_id: "", driver_id: "", from: "", to: "", search: "" });

  return (
    <>
      <PageHeader
        title="Trip Scheduling"
        description="Plan trips, assign vehicles and drivers, and manage the schedule."
        actions={
          canOperate && (
            <Button size="lg" onClick={() => router.push(`${TRIPS_PATH}/create`)}>
              <Plus className="h-5 w-5" /> Add New Trip
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4">
          <SearchInput
            value={(params.search as string) ?? ""}
            onChange={(search) => update({ search })}
            placeholder="Search trip no., reference, order, origin, destination, driver, plate…"
          />
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
            <Select value={params.status as string} onChange={(e) => update({ status: e.target.value })} options={statusOptions(TRIP_STATUS)} placeholder="All statuses" aria-label="Filter by status" />
            <Input type="date" value={params.from as string} max={(params.to as string) || undefined} onChange={(e) => update({ from: e.target.value })} aria-label="Departure from" title="Departure from" />
            <Input type="date" value={params.to as string} min={(params.from as string) || undefined} onChange={(e) => update({ to: e.target.value })} aria-label="Departure to" title="Departure to" />
            <Select
              value={params.vehicle_id as string}
              onChange={(e) => update({ vehicle_id: e.target.value })}
              options={(vehicles.data?.data ?? []).map((v) => ({ value: String(v.id), label: v.plate_number }))}
              placeholder="All vehicles"
              aria-label="Filter by vehicle"
            />
            <Select
              value={params.driver_id as string}
              onChange={(e) => update({ driver_id: e.target.value })}
              options={(drivers.data?.data ?? []).map((d) => ({ value: String(d.id), label: d.full_name }))}
              placeholder="All drivers"
              aria-label="Filter by driver"
            />
            <Button variant="ghost" onClick={clearFilters} disabled={!filtered}>
              <X className="h-4 w-4" /> Clear
            </Button>
          </div>
        </div>

        <DataTable
          rows={list.data?.data}
          loading={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(t) => t.id}
          sort={params.sort as string}
          onSortChange={(sort) => update({ sort })}
          onRowClick={(t) => router.push(`${TRIPS_PATH}/${t.id}`)}
          empty={
            filtered
              ? { title: "No trips match your filters", description: "Try a different search, date range or filter.", action: <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> }
              : {
                  title: "No trips yet",
                  description: "Scheduled trips will appear here.",
                  action: canOperate && (
                    <Button size="sm" onClick={() => router.push(`${TRIPS_PATH}/create`)}>
                      <Plus className="h-4 w-4" /> Add New Trip
                    </Button>
                  ),
                }
          }
          columns={[
            { key: "no", header: "Trip ID", sortKey: "trip_number", cell: (t) => <span className="font-semibold text-ink-900">{t.trip_number}</span> },
            {
              key: "ref",
              header: "Name / Reference",
              cell: (t) => (
                <span className="text-xs">
                  <span className="block font-medium text-ink-900">{t.reference_no ?? <span className="text-ink-400">—</span>}</span>
                  <span className="text-ink-500">
                    {labelOf(TRIP_TYPES, t.trip_type)}
                    {t.priority !== "normal" && <> · <span className={cn(t.priority === "urgent" && "font-semibold text-brand-700")}>{TRIP_PRIORITY[t.priority]?.label}</span></>}
                  </span>
                </span>
              ),
            },
            {
              key: "order",
              header: "Order",
              cell: (t) =>
                t.order ? (
                  <Link href={`/orders/${t.order.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink-900 hover:text-brand-600">
                    {t.order.order_number}
                  </Link>
                ) : (
                  <span className="text-ink-400">—</span>
                ),
            },
            { key: "vehicle", header: "Vehicle", cell: (t) => (t.vehicle ? <span className="font-medium text-ink-900">{t.vehicle.plate_number}</span> : <span className="text-ink-400">—</span>) },
            { key: "driver", header: "Driver", cell: (t) => t.driver?.full_name ?? <span className="text-ink-400">—</span> },
            { key: "origin", header: "Origin", cell: (t) => <span className="line-clamp-2 max-w-40 whitespace-normal">{t.origin}</span> },
            { key: "destination", header: "Destination", cell: (t) => <span className="line-clamp-2 max-w-40 whitespace-normal">{t.destination}</span> },
            { key: "dep", header: "Departure", sortKey: "departure_at", cell: (t) => <When value={t.departure_at} /> },
            { key: "arr", header: "Arrival", sortKey: "estimated_arrival_at", cell: (t) => <When value={t.actual_arrival_at ?? t.estimated_arrival_at} /> },
            { key: "status", header: "Status", sortKey: "status", cell: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} /> },
            {
              key: "actions",
              header: "Actions",
              // Pinned so the actions stay reachable when the table scrolls sideways.
              headerClassName: "sticky right-0 bg-ink-50 text-right",
              className: "sticky right-0 bg-white text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
              cell: (t) => (
                <div className="inline-flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <IconAction label={`View ${t.trip_number}`} href={`${TRIPS_PATH}/${t.id}`}>
                    <Eye />
                  </IconAction>
                  {canOperate && (
                    <>
                      <IconAction label={isEditable(t) ? `Edit ${t.trip_number}` : "Only scheduled trips can be edited"} href={`${TRIPS_PATH}/${t.id}/edit`} disabled={!isEditable(t)}>
                        <Pencil />
                      </IconAction>
                      <IconAction label={isDeletable(t) ? `Delete ${t.trip_number}` : "In-progress trips cannot be deleted"} onClick={() => setDeleting(t)} disabled={!isDeletable(t)} danger>
                        <Trash2 />
                      </IconAction>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
        <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="trips" />
      </Card>

      <DeleteTripDialog trip={deleting} loading={remove.isPending} error={remove.error?.message} onConfirm={() => remove.mutate(undefined)} onClose={() => { remove.reset(); setDeleting(null); }} />
    </>
  );
}

export function DeleteTripDialog({ trip, loading, error, onConfirm, onClose }: { trip: Trip | null; loading: boolean; error?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <ConfirmDialog
      open={!!trip}
      title="Delete trip"
      message={
        <>
          Delete <strong>{trip?.trip_number}</strong> ({trip?.origin} → {trip?.destination})? The trip is removed from the schedule, its vehicle and driver booking is released
          {trip?.order ? <>, and order <strong>{trip.order.order_number}</strong> goes back to pending if no other trip carries it</> : null}.
        </>
      }
      confirmLabel="Delete trip"
      loading={loading}
      error={error}
      onConfirm={() => onConfirm()}
      onClose={onClose}
    />
  );
}
