"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  Hourglass,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  SlidersHorizontal,
  Trash2,
  Truck,
  Upload,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Dropdown } from "@/components/ui/dropdown";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { useToast } from "@/components/ui/toast";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { ORDER_STATUS } from "@/lib/constants";
import { downloadFile, toCsv } from "@/lib/csv";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { ordersService } from "@/services/resources";
import type { ListParams, Order, OrderStatus } from "@/types/api";
import { OrderFormModal } from "./order-form";
import { OrderImportDialog } from "./order-import-dialog";
import { OrderPanel } from "./order-panel";
import { OrderStatusDialog } from "./order-status-dialog";

const SORTS = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "scheduled_delivery_at", label: "Delivery (soonest)" },
  { value: "-scheduled_delivery_at", label: "Delivery (latest)" },
  { value: "-amount", label: "Amount (highest)" },
  { value: "customer_name", label: "Customer A–Z" },
];

const CARDS: { status: OrderStatus | ""; label: string; icon: LucideIcon; tone: string }[] = [
  { status: "", label: "Total Orders", icon: Package, tone: "bg-brand-50 text-brand-600" },
  { status: "pending", label: "Pending", icon: Hourglass, tone: "bg-amber-50 text-amber-600" },
  { status: "scheduled", label: "Scheduled", icon: Truck, tone: "bg-indigo-50 text-indigo-600" },
  { status: "in_transit", label: "In Transit", icon: Truck, tone: "bg-sky-50 text-sky-600" },
  { status: "delivered", label: "Delivered", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
  { status: "cancelled", label: "Cancelled", icon: XCircle, tone: "bg-brand-50 text-brand-600" },
];

/** "Lot 12 X Park, Calamba, Laguna" -> "Calamba, Laguna" (same rule as the API's destination filter). */
export function destinationOf(address: string) {
  return (
    address
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p && !/\d/.test(p))
      .slice(-2)
      .join(", ") || address
  );
}

function Trend({ current, previous }: { current: number; previous: number }) {
  if (!current && !previous) return <p className="text-xs text-ink-400">No orders this month</p>;
  if (!previous) return <p className="text-xs text-ink-500">{current} booked this month</p>;
  const change = Math.round(((current - previous) / previous) * 100);
  const up = change >= 0;
  return (
    <p className="text-xs text-ink-500">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", up ? "text-emerald-600" : "text-brand-600")}>
        {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(change)}%
      </span>{" "}
      vs. last month
    </p>
  );
}

function DateRangeFilter({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const label = from || to ? `${from ? format(parseISO(from), "MMM dd, yyyy") : "…"} - ${to ? format(parseISO(to), "MMM dd, yyyy") : "…"}` : "All order dates";
  const preset = (start: Date, end: Date) => onChange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="input flex items-center gap-2 text-left" aria-expanded={open}>
        <CalendarDays className="h-4 w-4 shrink-0 text-ink-500" />
        <span className="flex-1 truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-72 space-y-3 rounded-lg border border-ink-100 bg-white p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-ink-500">
              From
              <Input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className="mt-1" />
            </label>
            <label className="text-xs text-ink-500">
              To
              <Input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className="mt-1" />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => preset(startOfMonth(new Date()), endOfMonth(new Date()))}>
              This month
            </Button>
            <Button size="sm" variant="secondary" onClick={() => preset(startOfMonth(subMonths(new Date(), 1)), endOfMonth(subMonths(new Date(), 1)))}>
              Last month
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange("", "")}>
              Clear
            </Button>
          </div>
          <Button size="sm" className="w-full" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}

async function exportOrders(params: ListParams, selected: Order[] | null) {
  let orders = selected ?? [];
  if (!selected) {
    for (let page = 1; ; page++) {
      const result = await ordersService.list({ ...params, page, per_page: 100 });
      orders = orders.concat(result.data);
      if (page >= result.meta.last_page) break;
    }
  }
  const rows = orders.map((o) => [
    o.order_number,
    o.customer_name,
    o.customer_contact,
    o.pickup_address,
    o.delivery_address,
    formatDate(o.created_at, "yyyy-MM-dd"),
    formatDate(o.scheduled_pickup_at, "yyyy-MM-dd HH:mm"),
    formatDate(o.scheduled_delivery_at, "yyyy-MM-dd HH:mm"),
    o.cargo_description,
    o.quantity,
    o.weight_kg,
    o.amount,
    o.payment_terms,
    ORDER_STATUS[o.status].label,
    o.is_delayed ? "Yes" : "No",
    o.vehicle?.plate_number,
    o.driver?.full_name,
  ]);
  const header = ["Order No.", "Customer", "Contact", "Pickup Address", "Delivery Address", "Order Date", "Pickup", "Delivery", "Cargo", "Quantity", "Weight (kg)", "Amount (PHP)", "Payment Terms", "Status", "Delayed", "Vehicle", "Driver"];
  downloadFile(`blitzmove-orders-${format(new Date(), "yyyyMMdd-HHmm")}.csv`, toCsv([header, ...rows]));
  return orders.length;
}

export function OrdersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useToast();
  const { canOperate } = usePermissions();
  const { params, update, setPage } = useListParams({
    search: searchParams.get("search") ?? "",
    sort: "-created_at",
    status: "",
    delayed: "",
    customer: "",
    destination: "",
    created_from: "",
    created_to: "",
  });
  const [editing, setEditing] = useState<Order | null | undefined>(undefined);
  const [statusFor, setStatusFor] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checked, setChecked] = useState<Map<number, Order>>(new Map());

  const list = useQuery({ queryKey: ["orders", params], queryFn: () => ordersService.list(params), placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: ["orders", "summary"], queryFn: ordersService.summary });
  const options = useQuery({ queryKey: ["orders", "filter-options"], queryFn: ordersService.filterOptions, staleTime: 60_000 });
  const stats = summary.data?.data ?? [];
  const stat = (status: string) => {
    const rows = status ? stats.filter((s) => s.status === status) : stats;
    return rows.reduce((acc, s) => ({ count: acc.count + s.count, this: acc.this + s.this_month, last: acc.last + s.last_month }), { count: 0, this: 0, last: 0 });
  };

  const remove = useApiMutation(() => ordersService.remove(deleting!.id), {
    invalidate: [["orders"], ["dashboard"]],
    onSuccess: () => {
      if (deleting?.id === selectedId) setSelectedId(null);
      setDeleting(null);
    },
  });

  const statusFilter = params.delayed ? "delayed" : (params.status as string);
  const filtered = ["status", "delayed", "customer", "destination", "created_from", "created_to", "search"].some((k) => params[k]);
  const clearFilters = () => update({ status: "", delayed: "", customer: "", destination: "", created_from: "", created_to: "", search: "" });

  const rows = list.data?.data ?? [];
  const allChecked = rows.length > 0 && rows.every((o) => checked.has(o.id));
  const toggle = (order: Order) =>
    setChecked((current) => {
      const next = new Map(current);
      if (next.has(order.id)) next.delete(order.id);
      else next.set(order.id, order);
      return next;
    });
  const toggleAll = () =>
    setChecked((current) => {
      const next = new Map(current);
      rows.forEach((o) => (allChecked ? next.delete(o.id) : next.set(o.id, o)));
      return next;
    });

  const runExport = async (onlySelected: boolean) => {
    setExporting(true);
    try {
      const count = await exportOrders({ ...params, page: undefined, per_page: undefined }, onlySelected ? [...checked.values()] : null);
      notify(`Exported ${count} order${count === 1 ? "" : "s"}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  const panel = selectedId ? <OrderPanel key={selectedId} id={selectedId} canEdit={canOperate} onEdit={(o) => setEditing(o)} onClose={() => setSelectedId(null)} /> : null;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">Manage and track all customer orders from booking to delivery.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {canOperate && (
            <Button variant="secondary" size="lg" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4" /> Import Orders
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={() => runExport(false)} loading={exporting}>
            <Download className="h-4 w-4" /> Export
          </Button>
          {canOperate && (
            <Button size="lg" onClick={() => setEditing(null)} className="min-w-36">
              <Plus className="h-5 w-5" /> New Order
            </Button>
          )}
        </div>
      </div>

      {/* Status cards double as quick filters. */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {CARDS.map((card) => {
          const s = stat(card.status);
          const active = !params.delayed && (params.status as string) === card.status;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => update({ status: card.status, delayed: "" })}
              aria-pressed={active}
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-card transition hover:border-ink-200",
                active ? "border-brand-300 ring-2 ring-brand-100" : "border-ink-100",
              )}
            >
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", card.tone)}>
                <card.icon className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-600">{card.label}</span>
                {summary.isLoading ? <span className="mt-1 block h-7 w-12 animate-pulse rounded bg-ink-100" /> : <span className="block text-2xl font-bold text-ink-900">{s.count}</span>}
                {!summary.isLoading && <Trend current={s.this} previous={s.last} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))_minmax(0,1.3fr)_auto]">
        <DateRangeFilter from={params.created_from as string} to={params.created_to as string} onChange={(created_from, created_to) => update({ created_from, created_to })} />
        <Select
          value={statusFilter}
          onChange={(e) => (e.target.value === "delayed" ? update({ status: "", delayed: "1" }) : update({ status: e.target.value, delayed: "" }))}
          options={[...Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label })), { value: "delayed", label: `Delayed${summary.data ? ` (${summary.data.meta.delayed})` : ""}` }]}
          placeholder="All Status"
          aria-label="Filter by status"
        />
        <Select value={params.customer as string} onChange={(e) => update({ customer: e.target.value })} options={(options.data?.data.customers ?? []).map((c) => ({ value: c, label: c }))} placeholder="All Customers" aria-label="Filter by customer" />
        <Select
          value={params.destination as string}
          onChange={(e) => update({ destination: e.target.value })}
          options={(options.data?.data.destinations ?? []).map((d) => ({ value: d, label: d }))}
          placeholder="All Destinations"
          aria-label="Filter by destination"
        />
        <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search order number, customer…" className="sm:col-span-2 lg:col-span-1" />
        <Button variant="secondary" onClick={() => setMoreFilters((v) => !v)} aria-expanded={moreFilters} className="h-10">
          <SlidersHorizontal className="h-4 w-4" /> Filter
        </Button>
      </div>
      {moreFilters && (
        <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-ink-600">
            Sort by
            <Select value={params.sort as string} onChange={(e) => update({ sort: e.target.value })} options={SORTS} className="w-52" aria-label="Sort orders" />
          </label>
          <p className="flex-1 text-xs text-ink-500">Tip: the status cards above also filter the table.</p>
          <Button variant="ghost" onClick={clearFilters} disabled={!filtered}>
            Clear all filters
          </Button>
        </Card>
      )}

      <div className={cn("grid gap-5", panel && "min-[1800px]:grid-cols-[minmax(0,1fr)_380px]")}>
        <Card className="min-w-0">
          {checked.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 bg-brand-50/50 px-4 py-2.5 text-sm">
              <span className="font-medium text-ink-900">{checked.size} selected</span>
              <Button size="sm" variant="secondary" onClick={() => runExport(true)} loading={exporting}>
                <Download className="h-3.5 w-3.5" /> Export selected
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setChecked(new Map())}>
                Clear selection
              </Button>
            </div>
          )}
          <DataTable
            rows={list.data?.data}
            loading={list.isFetching}
            error={list.error}
            onRetry={() => list.refetch()}
            rowKey={(o) => o.id}
            sort={params.sort as string}
            onSortChange={(sort) => update({ sort })}
            selectedKey={selectedId}
            onRowClick={(o) => setSelectedId(o.id)}
            rowClassName={(o) => (o.is_delayed ? "bg-brand-50/50 hover:bg-brand-50" : undefined)}
            empty={
              filtered
                ? { title: "No orders match your filters", description: "Try a different date range, status or search.", action: <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button> }
                : { title: "No orders yet", description: "Create an order or import a CSV to get started." }
            }
            columns={[
              {
                key: "select",
                header: <input type="checkbox" className="h-4 w-4 rounded border-ink-300 accent-brand-600" checked={allChecked} onChange={toggleAll} aria-label="Select all orders on this page" />,
                headerClassName: "w-10",
                cell: (o) => (
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-300 accent-brand-600"
                    checked={checked.has(o.id)}
                    onChange={() => toggle(o)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${o.order_number}`}
                  />
                ),
              },
              { key: "order_number", header: "Order No.", sortKey: "order_number", cell: (o) => <span className="font-medium text-ink-900">{o.order_number}</span> },
              { key: "customer", header: "Customer", sortKey: "customer_name", cell: (o) => <span className="text-ink-800">{o.customer_name}</span> },
              { key: "destination", header: "Destination", cell: (o) => <span title={o.delivery_address}>{destinationOf(o.delivery_address)}</span> },
              { key: "created", header: "Order Date", sortKey: "created_at", cell: (o) => formatDate(o.created_at) },
              { key: "delivery", header: "Delivery Date", sortKey: "scheduled_delivery_at", cell: (o) => formatDate(o.scheduled_delivery_at) },
              {
                key: "status",
                header: "Status",
                sortKey: "status",
                cell: (o) => (
                  <span className="inline-flex flex-wrap gap-1">
                    <StatusBadge status={o.status} map={ORDER_STATUS} dot={false} />
                    {o.is_delayed && <Badge tone="red">Delayed</Badge>}
                  </span>
                ),
              },
              { key: "amount", header: "Amount", sortKey: "amount", className: "text-right", headerClassName: "text-right", cell: (o) => (o.amount != null ? <span className="font-medium text-ink-900">{formatCurrency(o.amount)}</span> : <span className="text-ink-400">—</span>) },
              {
                key: "actions",
                header: "Actions",
                // Pinned so the menu stays reachable when the table scrolls sideways.
                headerClassName: "sticky right-0 bg-ink-50 text-center",
                className: "sticky right-0 bg-white text-center shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
                cell: (o) => (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      trigger={({ toggle: open }) => (
                        <button onClick={open} className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900" aria-label={`Actions for ${o.order_number}`}>
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      )}
                      items={[
                        { label: "View details", icon: <Eye />, onSelect: () => router.push(`/orders/${o.id}`) },
                        ...(canOperate
                          ? [
                              { label: "Edit", icon: <Pencil />, onSelect: () => setEditing(o), disabled: ["delivered", "cancelled"].includes(o.status) },
                              { label: "Change status", icon: <RefreshCcw />, onSelect: () => setStatusFor(o), disabled: o.allowed_transitions.length === 0 },
                              { label: "Cancel order", icon: <Ban />, onSelect: () => setStatusFor(o), disabled: !o.allowed_transitions.includes("cancelled" as OrderStatus) },
                              { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setDeleting(o), disabled: !["pending", "cancelled"].includes(o.status) },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                ),
              },
            ]}
          />
          <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="orders" showEdges />
        </Card>

        {/* Side panel on wide screens; a drawer on smaller ones. */}
        {panel && <div className="hidden min-[1800px]:sticky min-[1800px]:top-20 min-[1800px]:block min-[1800px]:max-h-[calc(100vh-6rem)] min-[1800px]:self-start">{panel}</div>}
      </div>
      {panel && (
        <div className="fixed inset-0 z-40 flex justify-end min-[1800px]:hidden">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setSelectedId(null)} aria-hidden />
          <div className="relative h-full w-full max-w-md p-2 sm:p-4">{panel}</div>
        </div>
      )}

      <OrderFormModal open={editing !== undefined} order={editing} onClose={() => setEditing(undefined)} />
      <OrderStatusDialog order={statusFor} onClose={() => setStatusFor(null)} />
      <OrderImportDialog open={importing} onClose={() => setImporting(false)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete order"
        message={
          <>
            Delete <strong>{deleting?.order_number}</strong> for {deleting?.customer_name}? Only pending or cancelled orders can be deleted.
          </>
        }
        confirmLabel="Delete order"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate(undefined)}
        onClose={() => {
          remove.reset();
          setDeleting(null);
        }}
      />
    </>
  );
}

export function OrderLink({ order }: { order: Pick<Order, "id" | "order_number"> }) {
  return (
    <Link href={`/orders/${order.id}`} className="font-medium text-ink-900 hover:text-brand-600">
      {order.order_number}
    </Link>
  );
}
