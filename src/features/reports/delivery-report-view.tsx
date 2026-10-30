"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CheckCircle2, Clock, FileSpreadsheet, Package, PieChart as PieChartIcon, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge, StatusBadge, TONE_HEX } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ORDER_STATUS, statusOptions } from "@/lib/constants";
import { exportCsv, fetchAllPages } from "@/lib/export";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { ordersService } from "@/services/resources";
import type { ListParams, Order, OrderStatus } from "@/types/api";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { reportsService } from "./api";
import { CountDonut, DailyBars, StackedRankBars } from "./ops-report-charts";
import { ConfigHeading, ReportConfigPanel, ReportHeader, ReportLayout, TABLE_CELL, TableCard, compact, focusPanel, monthPeriod, percent, useReportConfig } from "./report-page";
import { ChartCard, ChartEmpty, Stat } from "./report-widgets";

const PAGE_PATH = "/reports/deliveries";

interface Config {
  from: string;
  to: string;
  vehicle_id: string;
  driver_id: string;
  order_status: string;
  customer: string;
}

const defaults = (): Config => ({ ...monthPeriod(), vehicle_id: "", driver_id: "", order_status: "", customer: "" });

/** On time / Late for delivered orders, Delayed for open orders past their delivery time. */
function punctuality(o: Order): { label: string; tone: "green" | "red" | "amber" } | null {
  if (o.status === "delivered" && o.delivered_at) return new Date(o.delivered_at) <= new Date(o.scheduled_delivery_at) ? { label: "On Time", tone: "green" } : { label: "Late", tone: "red" };
  if (o.is_delayed) return { label: "Delayed", tone: "amber" };
  return null;
}

export function DeliveryReportView() {
  const notify = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const { vehicleOptions, driverOptions } = useFleetOptions();
  const config = useReportConfig(defaults, ["orders"]);
  const { draft, applied } = config;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("-scheduled_delivery_at");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(() => compact(applied), [applied]);
  const report = useQuery({
    queryKey: ["orders", "delivery-report", filters],
    queryFn: () => reportsService.deliveries(filters).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: config.ready,
  });
  const customers = useQuery({ queryKey: ["orders", "filter-options"], queryFn: () => ordersService.filterOptions().then((r) => r.data), staleTime: 60_000 });
  // /orders: the same period on the scheduled delivery time, and the same filters.
  const listFilters: ListParams = {
    delivery_from: applied.from,
    delivery_to: applied.to,
    vehicle_id: applied.vehicle_id || undefined,
    driver_id: applied.driver_id || undefined,
    status: applied.order_status || undefined,
    customer: applied.customer || undefined,
  };
  const listParams: ListParams = { ...listFilters, search: search || undefined, sort, page, per_page: perPage };
  const list = useQuery({ queryKey: ["orders", "delivery-list", listParams], queryFn: () => ordersService.list(listParams), placeholderData: keepPreviousData, enabled: config.ready });

  const r = report.data;
  const rows = list.data?.data;
  const offset = ((list.data?.meta.current_page ?? 1) - 1) * perPage;
  const filterCount = [applied.vehicle_id, applied.driver_id, applied.order_status, applied.customer].filter(Boolean).length;
  const hasOrders = !!r?.stats.total_orders.value;
  const customerOptions = (customers.data?.customers ?? []).map((c) => ({ value: c, label: c }));

  const exportOrders = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages(ordersService.list, { ...listFilters, search: search || undefined, sort });
      exportCsv(
        "delivery-report",
        ["Order No.", "Customer", "Vehicle", "Driver", "Pickup Address", "Delivery Address", "Scheduled Pickup", "Scheduled Delivery", "Delivered At", "On Time", "Status"],
        all.map((o) => [
          o.order_number,
          o.customer_name,
          o.vehicle?.plate_number,
          o.driver?.full_name,
          o.pickup_address,
          o.delivery_address,
          formatDateTime(o.scheduled_pickup_at),
          formatDateTime(o.scheduled_delivery_at),
          o.delivered_at ? formatDateTime(o.delivered_at) : "",
          punctuality(o)?.label ?? "",
          ORDER_STATUS[o.status]?.label ?? o.status,
        ]),
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  const exportSummary = () => {
    if (!r) return;
    const s = r.stats;
    exportCsv("delivery-report-summary", ["Delivery Report", `${r.period.from} to ${r.period.to}`, ""], [
      ["Metric", "This period", "Previous period"],
      ["Orders due", s.total_orders.value, s.total_orders.previous],
      ["Delivered", s.delivered.value, s.delivered.previous],
      ["On-time delivery rate (%)", s.on_time_rate.value, s.on_time_rate.previous],
      ["Delayed (open, past delivery time)", s.delayed.value, s.delayed.previous],
      ["Cancelled", s.cancelled.value, s.cancelled.previous],
      [],
      ["Status", "Orders", ""],
      ...r.by_status.map((x) => [ORDER_STATUS[x.key as OrderStatus]?.label ?? x.key, x.count, ""]),
      [],
      ["Customer", "Orders", "Delivered"],
      ...r.customers.map((c) => [c.label, c.count, c.delivered]),
      [],
      ["Date", "Due", "Delivered"],
      ...r.daily.map((d) => [d.date, d.scheduled, d.delivered]),
    ]);
  };

  const columns: Column<Order>[] = [
    { key: "index", header: "#", cell: (o) => <span className="text-ink-500">{offset + (rows?.indexOf(o) ?? 0) + 1}</span>, className: "w-10" },
    {
      key: "order",
      header: "Order No.",
      sortKey: "order_number",
      cell: (o) => (
        <Link href={`/orders/${o.id}`} className="font-medium whitespace-nowrap text-ink-900 hover:text-brand-600">
          {o.order_number}
        </Link>
      ),
    },
    { key: "customer", header: "Customer", sortKey: "customer_name", cell: (o) => <span className="whitespace-nowrap">{o.customer_name}</span> },
    { key: "vehicle", header: "Vehicle", cell: (o) => o.vehicle?.plate_number ?? "—" },
    { key: "driver", header: "Driver", cell: (o) => <span className="whitespace-nowrap">{o.driver?.full_name ?? "—"}</span> },
    {
      key: "route",
      header: "Pickup → Delivery",
      cell: (o) => (
        <span className="block max-w-64 min-w-40">
          <span className="block truncate text-ink-900" title={o.pickup_address}>
            {o.pickup_address}
          </span>
          <span className="block truncate text-ink-500" title={o.delivery_address}>
            → {o.delivery_address}
          </span>
        </span>
      ),
    },
    { key: "scheduled", header: "Scheduled Delivery", sortKey: "scheduled_delivery_at", cell: (o) => <span className="whitespace-nowrap">{formatDate(o.scheduled_delivery_at, "MMM d, yyyy hh:mm a")}</span> },
    { key: "delivered", header: "Delivered At", sortKey: "delivered_at", cell: (o) => <span className="whitespace-nowrap">{o.delivered_at ? formatDate(o.delivered_at, "MMM d, hh:mm a") : "—"}</span> },
    {
      key: "on_time",
      header: "On Time",
      cell: (o) => {
        const p = punctuality(o);
        return p ? <Badge tone={p.tone}>{p.label}</Badge> : <span className="text-ink-400">—</span>;
      },
    },
    { key: "status", header: "Status", sortKey: "status", cell: (o) => <StatusBadge status={o.status} map={ORDER_STATUS} /> },
  ];

  const statusSlices = (r?.by_status ?? []).map((s) => ({
    key: s.key,
    label: ORDER_STATUS[s.key as OrderStatus]?.label ?? s.key,
    value: s.count,
    color: TONE_HEX[ORDER_STATUS[s.key as OrderStatus]?.tone ?? "gray"],
  }));

  return (
    <div>
      <ReportHeader title="Delivery Report" subtitle="Track deliveries due in the period, completion and on-time performance." crumb="Delivery Reports" path={PAGE_PATH} />

      <ReportLayout
        config={
          <ReportConfigPanel
            panelRef={panelRef}
            period={draft}
            onPeriodChange={config.setPeriod}
            periodHint="Orders scheduled for delivery in this period."
            onReset={() => {
              config.reset();
              setSearch("");
              setPage(1);
            }}
            onGenerate={() => {
              config.generate();
              setPage(1);
            }}
            loading={report.isFetching && !report.isLoading}
            dirty={config.dirty}
          >
            <Field label="Order Status" htmlFor="dl-status">
              <Select id="dl-status" value={draft.order_status} onChange={(e) => config.set("order_status", e.target.value)} options={statusOptions(ORDER_STATUS)} placeholder="All Statuses" />
            </Field>
            <Field label="Customer" htmlFor="dl-customer">
              <Select id="dl-customer" value={draft.customer} onChange={(e) => config.set("customer", e.target.value)} options={customerOptions} placeholder="All Customers" />
            </Field>
            <ConfigHeading>Additional Filters</ConfigHeading>
            <Field label="Vehicle" htmlFor="dl-vehicle">
              <Select id="dl-vehicle" value={draft.vehicle_id} onChange={(e) => config.set("vehicle_id", e.target.value)} options={vehicleOptions} placeholder="All Vehicles" />
            </Field>
            <Field label="Driver" htmlFor="dl-driver">
              <Select id="dl-driver" value={draft.driver_id} onChange={(e) => config.set("driver_id", e.target.value)} options={driverOptions} placeholder="All Drivers" />
            </Field>
          </ReportConfigPanel>
        }
      >
        {report.error && <ErrorState className="rounded-xl border border-ink-100 bg-white" message={report.error.message} onRetry={() => report.refetch()} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <Stat icon={Package} tone="bg-blue-50 text-blue-600" label="Orders Due" stat={r?.stats.total_orders} format={(v) => formatNumber(v)} title="Orders scheduled for delivery in the period" />
          <Stat icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" label="Delivered" stat={r?.stats.delivered} format={(v) => formatNumber(v)} />
          <Stat icon={Clock} tone="bg-orange-50 text-orange-500" label="On-Time Delivery" stat={r?.stats.on_time_rate} format={percent} points title="Delivered orders delivered by their scheduled delivery time" />
          <Stat icon={AlertTriangle} tone="bg-brand-50 text-brand-600" label="Delayed" stat={r?.stats.delayed} format={(v) => formatNumber(v)} upIsBad title="Open orders whose scheduled delivery time has passed" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <ChartCard icon={<BarChart3 />} title="Deliveries per Day" className="lg:col-span-3">
            {!r ? (
              <LoadingState />
            ) : hasOrders ? (
              <DailyBars data={r.daily} series={[{ key: "scheduled", label: "Due", color: "#3b82f6" }, { key: "delivered", label: "Delivered", color: "#16a34a" }]} />
            ) : (
              <ChartEmpty text="No orders are due for delivery in this period." />
            )}
          </ChartCard>
          <ChartCard icon={<PieChartIcon />} title="Delivery Status" className="lg:col-span-2" bodyClassName="flex h-auto min-h-64 items-center">
            {!r ? <LoadingState className="w-full" /> : hasOrders ? <CountDonut slices={statusSlices} centerLabel="Orders" /> : <ChartEmpty text="No orders are due for delivery in this period." />}
          </ChartCard>
        </div>

        <ChartCard icon={<Users />} title="Top Customers" bodyClassName="h-72">
          {!r ? (
            <LoadingState />
          ) : r.customers.length ? (
            <StackedRankBars
              data={r.customers.slice(0, 8).map((c) => ({ label: c.label, delivered: c.delivered, other: c.count - c.delivered }))}
              series={[
                { key: "delivered", label: "Delivered", color: "#16a34a" },
                { key: "other", label: "Not delivered", color: "#93c5fd" },
              ]}
            />
          ) : (
            <ChartEmpty text="No orders are due for delivery in this period." />
          )}
        </ChartCard>

        <TableCard
          icon={<Package />}
          title="Deliveries"
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search orders..."
          filterCount={filterCount}
          onFilter={() => focusPanel(panelRef)}
          exporting={exporting}
          exportItems={[
            { label: "Deliveries (Excel CSV)", icon: <FileSpreadsheet />, disabled: !list.data?.meta.total, onSelect: exportOrders },
            { label: "Report summary (Excel CSV)", icon: <BarChart3 />, disabled: !r, onSelect: exportSummary },
          ]}
        >
          <DataTable
            columns={columns.map((c) => ({ ...c, className: cn(TABLE_CELL, c.className), headerClassName: cn("px-3", c.headerClassName) }))}
            rows={rows}
            rowKey={(o) => o.id}
            loading={list.isFetching}
            error={list.error}
            onRetry={() => list.refetch()}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            empty={
              search || filterCount
                ? { title: "No deliveries match", description: "Try a different search, or change the filters in Report Configuration." }
                : { title: "No deliveries in this period", description: "Orders scheduled for delivery in the selected period will appear here." }
            }
          />
          <Pagination
            meta={list.data?.meta}
            onPageChange={setPage}
            perPage={perPage}
            onPerPageChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
            noun="orders"
            showEdges
          />
        </TableCard>
      </ReportLayout>
    </div>
  );
}
