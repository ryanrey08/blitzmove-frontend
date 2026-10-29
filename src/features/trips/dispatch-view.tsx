"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Eye, MoreVertical, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dropdown } from "@/components/ui/dropdown";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { TRIP_STATUS } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/utils";
import { tripsService } from "@/services/resources";
import type { Trip } from "@/types/api";
import { DISPATCH_PATH, TRANSITIONS, availableTransitions, dispatchPath, useTripTransition } from "./trip-status-actions";

/** Pre-dispatch checks mirroring TripService::dispatch; optional items don't block. */
export function checklist(trip: Trip) {
  const departureDay = trip.departure_at.slice(0, 10);
  return [
    { label: "Vehicle and driver assigned", ok: !!trip.vehicle && !!trip.driver },
    { label: "Vehicle is available for service", ok: !!trip.vehicle && ["available", "on_trip"].includes(trip.vehicle.status) },
    { label: "Driver is active", ok: !!trip.driver && ["available", "on_trip"].includes(trip.driver.status) },
    { label: "Driver's license valid on departure date", ok: !!trip.driver && trip.driver.license_expiry >= departureDay },
    { label: "Route has origin and destination stops", ok: (trip.stops?.length ?? trip.stops_count ?? 0) >= 2 },
    { label: "Linked to a customer order", ok: !!trip.order, optional: true },
  ];
}

const OPEN = ["scheduled", "dispatched", "in_progress"];
const TABS = [
  { value: "", label: "All open" },
  { value: "scheduled", label: "Scheduled" },
  { value: "dispatched", label: "Dispatched" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function When({ value }: { value: string | null }) {
  if (!value) return <span className="text-ink-400">—</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="block text-ink-900">{formatDate(value)}</span>
      <span className="text-xs text-ink-500">{formatTime(value)}</span>
    </span>
  );
}

export function DispatchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canOperate } = usePermissions();
  const initialStatus = searchParams.get("status") ?? "";
  const { params, update, setPage } = useListParams({ status: OPEN.includes(initialStatus) || ["completed", "cancelled"].includes(initialStatus) ? initialStatus : "", sort: "departure_at", per_page: 10 });
  // "All open" uses the API's dispatch scope; closed tabs filter by status alone.
  const query = { ...params, scope: params.status ? undefined : "dispatch" };
  const list = useQuery({ queryKey: ["trips", "dispatch-board", query], queryFn: () => tripsService.list(query), placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: ["trips", "summary"], queryFn: tripsService.summary });
  const count = (s: string) => summary.data?.data.find((x) => x.status === s)?.count;
  const transition = useTripTransition();

  // Old links (`/transportation/dispatch?trip=12`) now open the trip's dispatch page.
  const legacyTrip = searchParams.get("trip");
  useEffect(() => {
    if (legacyTrip) router.replace(`${DISPATCH_PATH}/${legacyTrip}`);
  }, [legacyTrip, router]);

  return (
    <>
      <PageHeader title="Dispatch Management" description="Review scheduled and active trips, dispatch them to drivers, and track their progress." />
      <Card>
        <Tabs
          className="px-4 pt-2"
          value={params.status as string}
          onChange={(status) => update({ status })}
          tabs={TABS.map((t) => ({ ...t, count: t.value ? count(t.value) : undefined }))}
        />
        <div className="p-4">
          <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search trip, order, driver, plate, destination…" />
        </div>
        <DataTable
          rows={list.data?.data}
          loading={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(t) => t.id}
          sort={params.sort as string}
          onSortChange={(sort) => update({ sort })}
          onRowClick={(t) => router.push(dispatchPath(t))}
          empty={{ title: params.status ? `No ${TRIP_STATUS[params.status as Trip["status"]]?.label.toLowerCase()} trips` : "No open trips", description: "Schedule a trip in Trip Scheduling to dispatch it here." }}
          columns={[
            { key: "no", header: "Trip No.", sortKey: "trip_number", cell: (t) => <span className="font-semibold text-ink-900">{t.trip_number}</span> },
            { key: "route", header: "Route", cell: (t) => <span className="line-clamp-2 max-w-52 whitespace-normal">{t.origin} → {t.destination}</span> },
            { key: "dep", header: "Departure", sortKey: "departure_at", cell: (t) => <When value={t.departure_at} /> },
            { key: "vehicle", header: "Vehicle", cell: (t) => <span className="font-medium text-ink-900">{t.vehicle?.plate_number}</span> },
            { key: "driver", header: "Driver", cell: (t) => t.driver?.full_name },
            {
              key: "order",
              header: "Order",
              cell: (t) =>
                t.order ? (
                  <Link href={`/orders/${t.order.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-brand-600">
                    {t.order.order_number}
                  </Link>
                ) : (
                  <span className="text-ink-400">—</span>
                ),
            },
            { key: "dispatched", header: "Dispatched", cell: (t) => <When value={t.dispatched_at} /> },
            { key: "status", header: "Status", sortKey: "status", cell: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} /> },
            {
              key: "actions",
              header: "Actions",
              // Pinned so the actions stay reachable when the table scrolls sideways.
              headerClassName: "sticky right-0 bg-ink-50 text-right",
              className: "sticky right-0 bg-white text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
              cell: (t) => {
                const transitions = canOperate ? availableTransitions(t) : [];
                const [primary, ...more] = transitions.filter((k) => k !== "cancelled" && k !== "recall");
                const secondary = [...more, ...transitions.filter((k) => k === "recall" || k === "cancelled")];
                return (
                  // Stop clicks here from reaching the row's navigation.
                  <div className="inline-flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {canOperate && t.status === "scheduled" ? (
                      <Button size="sm" onClick={() => router.push(dispatchPath(t))}>
                        <Send className="h-3.5 w-3.5" /> Dispatch
                      </Button>
                    ) : primary ? (
                      <Button size="sm" variant="secondary" onClick={() => transition.request(t, primary)} className="[&>svg]:h-3.5 [&>svg]:w-3.5">
                        {TRANSITIONS[primary].icon} {TRANSITIONS[primary].label}
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => router.push(dispatchPath(t))}>
                        <Eye className="h-3.5 w-3.5" /> View Trip
                      </Button>
                    )}
                    <Dropdown
                      trigger={({ toggle }) => (
                        <button onClick={toggle} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800" aria-label={`More actions for ${t.trip_number}`}>
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      )}
                      items={[
                        { label: "View Trip", icon: <Eye />, onSelect: () => router.push(dispatchPath(t)) },
                        ...secondary.map((key) => ({ label: TRANSITIONS[key].label, icon: TRANSITIONS[key].icon, danger: key === "cancelled", onSelect: () => transition.request(t, key) })),
                      ]}
                    />
                  </div>
                );
              },
            },
          ]}
        />
        <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="trips" />
      </Card>
      {transition.dialog}
    </>
  );
}
