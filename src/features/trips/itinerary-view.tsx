"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { CheckCircle2, Download, Eye, Flag, Hourglass, MapPin, MoreVertical, SkipForward, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dropdown } from "@/components/ui/dropdown";
import { Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { StatFilterCards } from "@/components/ui/stat-filter-cards";
import { useToast } from "@/components/ui/toast";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { STOP_STATUS, STOP_TYPE, TRIP_STATUS, statusOptions } from "@/lib/constants";
import { exportCsv, fetchAllPages } from "@/lib/export";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { stopsService } from "@/services/resources";
import type { StopStatus, TripStop } from "@/types/api";
import { ITINERARY_PATH } from "./itinerary-trip-view";
import { TRIP_KEYS } from "./use-trip";

type Range = "today" | "tomorrow" | "week" | "date";

const STOP_CARDS = [
  { key: "", label: "Total Stops", icon: MapPin, tone: "bg-brand-50 text-brand-600" },
  { key: "pending", label: "Pending", icon: Hourglass, tone: "bg-amber-50 text-amber-600" },
  { key: "arrived", label: "Arrived", icon: Flag, tone: "bg-sky-50 text-sky-600" },
  { key: "completed", label: "Completed", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
  { key: "skipped", label: "Skipped", icon: SkipForward, tone: "bg-ink-100 text-ink-600" },
];
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
  const notify = useToast();
  const { params, update, setPage } = useListParams({ range: "today", date: format(new Date(), "yyyy-MM-dd"), status: "", trip_status: "", per_page: 15 });
  const range = params.range as Range;
  const { from, to } = bounds(range, params.date as string);
  const query = { page: params.page, per_page: params.per_page, search: params.search, status: params.status, trip_status: params.trip_status, sort: params.sort, from, to };
  const list = useQuery({ queryKey: ["stops", "board", query], queryFn: () => stopsService.board(query), placeholderData: keepPreviousData });

  const counts = list.data?.counts;
  const periodLabel = range === "week" ? `${formatDate(from, "MMM d")} – ${formatDate(to, "MMM d, yyyy")}` : formatDate(from, "EEE, MMM d, yyyy");
  const [exporting, setExporting] = useState(false);
  const runExport = async () => {
    setExporting(true);
    try {
      const stops = await fetchAllPages(stopsService.board, { ...query, page: undefined, per_page: undefined });
      exportCsv(
        "itinerary",
        ["ETA", "Stop", "Type", "Location", "Address", "Customer", "Order", "Trip", "Trip Status", "Vehicle", "Driver", "Stop Status", "Actual Arrival"],
        stops.map((s) => [
          formatDateTime(s.estimated_arrival_at ?? s.trip?.departure_at),
          s.sequence,
          STOP_TYPE[s.type].label,
          s.location_name,
          s.address,
          s.order?.customer_name,
          s.order?.order_number,
          s.trip?.trip_number,
          s.trip ? TRIP_STATUS[s.trip.status].label : "",
          s.trip?.vehicle?.plate_number,
          s.trip?.driver?.full_name,
          STOP_STATUS[s.status].label,
          s.actual_arrival_at ? formatDateTime(s.actual_arrival_at) : "",
        ]),
      );
      notify(`Exported ${stops.length} stop${stops.length === 1 ? "" : "s"}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  const progress = useApiMutation(({ stop, status }: { stop: TripStop; status: StopStatus }) => stopsService.update(stop.trip_id, stop.id, { status }), {
    invalidate: [["stops"], ...TRIP_KEYS],
  });

  return (
    <>
      <PageHeader
        title="Itinerary"
        description="Every stop across trips, in time order, with arrival progress."
        actions={
          <Button variant="secondary" size="lg" onClick={runExport} loading={exporting}>
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      <StatFilterCards
        active={params.status as string}
        onSelect={(status) => update({ status })}
        loading={!list.data}
        cards={STOP_CARDS.map((card) => ({
          ...card,
          count: counts ? (card.key ? (counts[card.key as StopStatus] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)) : undefined,
          hint: periodLabel,
        }))}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_repeat(2,minmax(0,1fr))_minmax(0,1.6fr)_auto]">
        <Select value={range} onChange={(e) => update({ range: e.target.value })} options={RANGES} aria-label="Period" />
        {range === "date" ? (
          <Input type="date" value={params.date as string} onChange={(e) => update({ date: e.target.value })} aria-label="Stops on date" />
        ) : (
          <p className="input flex items-center bg-ink-50 text-ink-600">{periodLabel}</p>
        )}
        <Select value={params.status as string} onChange={(e) => update({ status: e.target.value })} options={statusOptions(STOP_STATUS)} placeholder="All Stop Status" aria-label="Filter by stop status" />
        <Select value={params.trip_status as string} onChange={(e) => update({ trip_status: e.target.value })} options={statusOptions(TRIP_STATUS)} placeholder="All Trip Status" aria-label="Filter by trip status" />
        <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search stop, trip, order, customer…" className="sm:col-span-2 lg:col-span-1" />
        <Button variant="secondary" onClick={() => update({ status: "", trip_status: "", search: "" })} disabled={!params.status && !params.trip_status && !params.search} className="h-10">
          <X className="h-4 w-4" /> Clear
        </Button>
      </div>

      <Card>
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
                  {s.trip && <StatusBadge status={s.trip.status} map={TRIP_STATUS} dot={false} />}
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
                  <StatusBadge status={s.status} map={STOP_STATUS} dot={false} />
                  {s.actual_arrival_at && <span className="text-xs text-ink-500">at {formatTime(s.actual_arrival_at)}</span>}
                </span>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              // Pinned so the menu stays reachable when the table scrolls sideways.
              headerClassName: "sticky right-0 bg-ink-50 text-center",
              className: "sticky right-0 bg-white text-center shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
              cell: (s) => {
                const actions = canOperate ? progressActions(s) : [];
                return (
                  // Clicks here must not open the row.
                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      trigger={({ toggle }) => (
                        <button onClick={toggle} className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900" aria-label={`Actions for stop ${s.location_name}`}>
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      )}
                      items={[
                        ...actions.map((a) => ({
                          label: a.status === "arrived" ? "Mark arrived" : a.status === "skipped" ? "Skip stop" : "Mark completed",
                          icon: a.status === "completed" ? <CheckCircle2 /> : a.status === "skipped" ? <SkipForward /> : <MapPin />,
                          onSelect: () => progress.mutate({ stop: s, status: a.status }),
                          disabled: progress.isPending,
                        })),
                        { label: "View itinerary", icon: <Eye />, onSelect: () => router.push(`${ITINERARY_PATH}/${s.trip_id}`) },
                      ]}
                    />
                  </div>
                );
              },
            },
          ]}
        />
        <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="stops" showEdges />
      </Card>
      <p className="mt-3 text-xs text-ink-500">Stop progress (Arrived, Completed, Skip) can be recorded only while the trip is in progress. Start trips from Dispatch Management.</p>
    </>
  );
}
