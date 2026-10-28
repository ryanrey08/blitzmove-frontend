"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, List, Route } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { LoadingState } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { TRIP_STATUS, statusOptions } from "@/lib/constants";
import { cn, formatDateTime, formatTime } from "@/lib/utils";
import { tripsService } from "@/services/resources";
import { TripScheduleForm } from "./trip-form";

const DOT: Record<string, string> = {
  scheduled: "border-l-indigo-500",
  dispatched: "border-l-orange-500",
  in_progress: "border-l-sky-500",
  completed: "border-l-emerald-500",
  cancelled: "border-l-ink-300",
};

function WeekCalendar() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const { data, isLoading } = useQuery({
    queryKey: ["trips", "week", weekStart.toISOString()],
    queryFn: () => tripsService.list({ from: format(weekStart, "yyyy-MM-dd"), to: format(addDays(weekStart, 6), "yyyy-MM-dd"), per_page: 100, sort: "departure_at" }),
    placeholderData: keepPreviousData,
  });
  const trips = (data?.data ?? []).filter((t) => t.status !== "cancelled");

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold text-ink-900">
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </p>
        <div className="flex gap-1">
          <Button variant="secondary" size="icon" onClick={() => setWeekStart((d) => addDays(d, -7))} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            This week
          </Button>
          <Button variant="secondary" size="icon" onClick={() => setWeekStart((d) => addDays(d, 7))} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-px border-t border-ink-100 bg-ink-100 sm:grid-cols-7">
          {days.map((day) => {
            const items = trips.filter((t) => isSameDay(parseISO(t.departure_at), day));
            const today = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className="min-h-32 bg-white p-2">
                <p className={cn("mb-2 text-xs font-semibold", today ? "text-brand-600" : "text-ink-500")}>
                  {format(day, "EEE d")}
                  {today && " · Today"}
                </p>
                <ul className="space-y-1.5">
                  {items.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/transportation/itinerary?trip=${t.id}`}
                        className={cn("block rounded-md border border-l-4 border-ink-100 bg-ink-50 px-2 py-1.5 text-xs hover:bg-white hover:shadow-sm", DOT[t.status])}
                        title={`${t.trip_number}: ${t.origin} → ${t.destination} (${TRIP_STATUS[t.status].label})`}
                      >
                        <span className="block font-semibold text-ink-900">
                          {formatTime(t.departure_at)} · {t.trip_number.replace(/^TRIP-\d{4}-/, "#")}
                        </span>
                        <span className="block truncate text-ink-600">→ {t.destination}</span>
                        <span className="block truncate text-ink-500">{t.vehicle?.plate_number}</span>
                      </Link>
                    </li>
                  ))}
                  {items.length === 0 && <li className="text-xs text-ink-300">—</li>}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScheduleList() {
  const { params, update, setPage } = useListParams({ sort: "departure_at", status: "scheduled" });
  const list = useQuery({ queryKey: ["trips", params], queryFn: () => tripsService.list(params), placeholderData: keepPreviousData });

  return (
    <>
      <div className="flex justify-end px-4 py-3">
        <Select value={params.status as string} onChange={(e) => update({ status: e.target.value })} options={statusOptions(TRIP_STATUS)} placeholder="All statuses" className="w-44" aria-label="Filter by status" />
      </div>
      <DataTable
        rows={list.data?.data}
        loading={list.isFetching}
        error={list.error}
        onRetry={() => list.refetch()}
        rowKey={(t) => t.id}
        sort={params.sort as string}
        onSortChange={(sort) => update({ sort })}
        empty={{ title: "No trips", description: "Scheduled trips will appear here." }}
        columns={[
          { key: "no", header: "Trip No.", sortKey: "trip_number", cell: (t) => <Link href={`/transportation/itinerary?trip=${t.id}`} className="font-semibold text-ink-900 hover:text-brand-600">{t.trip_number}</Link> },
          { key: "order", header: "Order", cell: (t) => t.order?.order_number ?? <span className="text-ink-400">—</span> },
          { key: "route", header: "Route", cell: (t) => <span className="whitespace-nowrap">{t.origin} → {t.destination}</span> },
          { key: "dep", header: "Departure", sortKey: "departure_at", cell: (t) => <span className="whitespace-nowrap">{formatDateTime(t.departure_at)}</span> },
          { key: "eta", header: "Est. Arrival", sortKey: "estimated_arrival_at", cell: (t) => <span className="whitespace-nowrap">{formatDateTime(t.estimated_arrival_at)}</span> },
          { key: "res", header: "Vehicle / Driver", cell: (t) => (<span className="text-xs"><span className="block font-medium text-ink-900">{t.vehicle?.plate_number}</span><span className="text-ink-500">{t.driver?.full_name}</span></span>) },
          { key: "stops", header: "Stops", cell: (t) => t.stops_count ?? "—" },
          { key: "status", header: "Status", sortKey: "status", cell: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} /> },
        ]}
      />
      <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="trips" />
    </>
  );
}

export function TripScheduleView() {
  const searchParams = useSearchParams();
  const { canOperate } = usePermissions();
  const [view, setView] = useState<"calendar" | "list">("calendar");

  return (
    <>
      <PageHeader title="Trip Scheduling" description="Plan trips, assign available vehicles and drivers, and review the schedule." />
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {canOperate && (
          <Card>
            <CardHeader title="Schedule a Trip" icon={<Route />} description="Select order, resources, route and times." />
            <CardBody>
              <TripScheduleForm initialOrderId={searchParams.get("order") ?? undefined} />
            </CardBody>
          </Card>
        )}
        <Card className={cn(!canOperate && "2xl:col-span-2")}>
          <CardHeader
            title="Trip Schedule"
            icon={<CalendarDays />}
            action={
              <div className="flex rounded-lg border border-ink-200 p-0.5" role="group" aria-label="Schedule view">
                <button onClick={() => setView("calendar")} aria-pressed={view === "calendar"} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", view === "calendar" ? "bg-brand-600 text-white" : "text-ink-600")}>
                  <CalendarDays className="h-3.5 w-3.5" /> Week
                </button>
                <button onClick={() => setView("list")} aria-pressed={view === "list"} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", view === "list" ? "bg-brand-600 text-white" : "text-ink-600")}>
                  <List className="h-3.5 w-3.5" /> List
                </button>
              </div>
            }
          />
          {view === "calendar" ? <WeekCalendar /> : <ScheduleList />}
        </Card>
      </div>
    </>
  );
}
