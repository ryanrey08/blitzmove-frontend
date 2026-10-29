"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { CheckCircle2, Eye, MapPin, SkipForward } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { STOP_STATUS, STOP_TYPE, TRIP_STATUS, statusOptions } from "@/lib/constants";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { stopsService } from "@/services/resources";
import type { StopStatus, TripStop } from "@/types/api";
import { ITINERARY_PATH } from "./itinerary-trip-view";
import { TRIP_KEYS } from "./use-trip";

type Range = "today" | "tomorrow" | "week" | "date";
const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "Next 7 days" },
  { value: "date", label: "Pick a date" },
];

/** The viewer's local day bounds as ISO strings, so "today" means today where they are. */
function bounds(range: Range, date: string): { from: string; to: string } {
  const base = range === "date" && date ? new Date(`${date}T00:00`) : new Date();
  const start = startOfDay(range === "tomorrow" ? addDays(base, 1) : base);
  const end = endOfDay(range === "week" ? addDays(start, 6) : start);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Stop moves the backend allows: progress is only recorded while the trip is in progress (ItineraryService::updateStop). */
function progressActions(stop: TripStop): { status: StopStatus; label: string }[] {
  if (stop.trip?.status !== "in_progress") return [];
  if (stop.status === "pending")
    return [
      { status: "arrived", label: "Arrived" },
      { status: "completed", label: "Completed" },
      ...(stop.type === "stop" ? [{ status: "skipped" as StopStatus, label: "Skip" }] : []),
    ];
  if (stop.status === "arrived") return [{ status: "completed", label: "Mark completed" }];
  return [];
}

export function ItineraryView() {
  const router = useRouter();
  const { canOperate } = usePermissions();
  const { params, update, setPage } = useListParams({ range: "today", date: format(new Date(), "yyyy-MM-dd"), status: "", trip_status: "", per_page: 15 });
  const range = params.range as Range;
  const { from, to } = bounds(range, params.date as string);
  const query = { page: params.page, per_page: params.per_page, search: params.search, status: params.status, trip_status: params.trip_status, sort: params.sort, from, to };
  const list = useQuery({ queryKey: ["stops", "board", query], queryFn: () => stopsService.board(query), placeholderData: keepPreviousData });

  const progress = useApiMutation(({ stop, status }: { stop: TripStop; status: StopStatus }) => stopsService.update(stop.trip_id, stop.id, { status }), {
    invalidate: [["stops"], ...TRIP_KEYS],
  });

  return (
    <>
      <PageHeader title="Itinerary" description="Every stop across trips, in time order, with arrival progress." />
      <Card>
        <Tabs className="px-4 pt-2" value={range} onChange={(value) => update({ range: value })} tabs={RANGES} />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search stop, address, trip, order, customer, driver…" className="sm:col-span-2 lg:col-span-1" />
          {range === "date" ? (
            <Input type="date" value={params.date as string} onChange={(e) => update({ date: e.target.value })} aria-label="Stops on date" />
          ) : (
            <p className="flex items-center text-sm text-ink-500">
              {range === "week" ? `${formatDate(from)} – ${formatDate(to)}` : formatDate(from, "EEEE, MMM d, yyyy")}
            </p>
          )}
          <Select value={params.status as string} onChange={(e) => update({ status: e.target.value })} options={statusOptions(STOP_STATUS)} placeholder="All stop statuses" aria-label="Filter by stop status" />
          <Select value={params.trip_status as string} onChange={(e) => update({ trip_status: e.target.value })} options={statusOptions(TRIP_STATUS)} placeholder="All trip statuses" aria-label="Filter by trip status" />
        </div>

        <DataTable
          rows={list.data?.data}
          loading={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(s) => s.id}
          onRowClick={(s) => router.push(`${ITINERARY_PATH}/${s.trip_id}`)}
          rowClassName={(s) => (s.status === "completed" || s.status === "skipped" ? "text-ink-500" : undefined)}
          empty={{ title: "No stops in this period", description: "Stops of scheduled and active trips appear here by their ETA. Try another day or clear the filters." }}
          columns={[
            {
              key: "eta",
              header: "ETA",
              cell: (s) => {
                const when = s.estimated_arrival_at ?? s.trip?.departure_at ?? null;
                return (
                  <span className="whitespace-nowrap" title={s.estimated_arrival_at ? undefined : "No ETA set; showing the trip's departure"}>
                    <span className="block font-semibold text-ink-900">
                      {s.estimated_arrival_at ? "" : "≈ "}
                      {formatTime(when)}
                    </span>
                    <span className="text-xs text-ink-500">{formatDate(when, "EEE, MMM d")}</span>
                  </span>
                );
              },
            },
            {
              key: "stop",
              header: "Stop",
              cell: (s) => (
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700">{s.sequence}</span>
                  <StatusBadge status={s.type} map={STOP_TYPE} dot={false} />
                </span>
              ),
            },
            {
              key: "location",
              header: "Location",
              cell: (s) => (
                <span className="block max-w-64">
                  <span className="block font-medium text-ink-900">{s.location_name}</span>
                  {s.address && <span className="block truncate text-xs text-ink-500">{s.address}</span>}
                </span>
              ),
            },
            {
              key: "order",
              header: "Customer / Order",
              cell: (s) =>
                s.order ? (
                  <span className="text-xs">
                    <span className="block font-medium text-ink-900">{s.order.customer_name}</span>
                    <Link href={`/orders/${s.order.id}`} onClick={(e) => e.stopPropagation()} className="text-ink-500 hover:text-brand-600">
                      {s.order.order_number}
                    </Link>
                  </span>
                ) : (
                  <span className="text-ink-400">—</span>
                ),
            },
            {
              key: "trip",
              header: "Trip",
              cell: (s) => (
                <span className="flex flex-col items-start gap-1">
                  <span className="font-semibold text-ink-900">{s.trip?.trip_number}</span>
                  {s.trip && <StatusBadge status={s.trip.status} map={TRIP_STATUS} />}
                </span>
              ),
            },
            {
              key: "crew",
              header: "Vehicle / Driver",
              cell: (s) => (
                <span className="text-xs">
                  <span className="block font-medium text-ink-900">{s.trip?.vehicle?.plate_number ?? "—"}</span>
                  <span className="text-ink-500">{s.trip?.driver?.full_name}</span>
                </span>
              ),
            },
            {
              key: "status",
              header: "Stop Status",
              cell: (s) => (
                <span className="flex flex-col items-start gap-0.5">
                  <StatusBadge status={s.status} map={STOP_STATUS} />
                  {s.actual_arrival_at && <span className="text-xs text-ink-500">at {formatTime(s.actual_arrival_at)}</span>}
                </span>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              headerClassName: "sticky right-0 bg-ink-50 text-right",
              className: "sticky right-0 bg-white text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
              cell: (s) => {
                const actions = canOperate ? progressActions(s) : [];
                return (
                  // Clicks here must not open the row.
                  <div className="inline-flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {actions.map((a) => (
                      <Button
                        key={a.status}
                        size="sm"
                        variant={a.status === "skipped" ? "ghost" : a.status === "completed" ? "primary" : "secondary"}
                        loading={progress.isPending && progress.variables?.stop.id === s.id && progress.variables.status === a.status}
                        onClick={() => progress.mutate({ stop: s, status: a.status })}
                      >
                        {a.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {a.status === "skipped" && <SkipForward className="h-3.5 w-3.5" />}
                        {a.status === "arrived" && <MapPin className="h-3.5 w-3.5" />}
                        {a.label}
                      </Button>
                    ))}
                    {actions.length === 0 && (
                      <Button size="sm" variant="ghost" onClick={() => router.push(`${ITINERARY_PATH}/${s.trip_id}`)} className={cn(s.trip?.status === "in_progress" && "text-ink-500")}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
        <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="stops" />
      </Card>
      <p className="mt-3 text-xs text-ink-500">Stop progress (Arrived, Completed, Skip) can be recorded only while the trip is in progress. Start trips from Dispatch Management.</p>
    </>
  );
}
