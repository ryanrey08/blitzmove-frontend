"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, Eye, MoreVertical, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Dropdown } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { ORDER_STATUS, statusOptions } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { ordersService } from "@/services/resources";
import type { Order, OrderStatus } from "@/types/api";
import { OrderFormModal } from "./order-form";
import { OrderStatusDialog } from "./order-status-dialog";

const SORTS = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "scheduled_pickup_at", label: "Pickup (soonest)" },
  { value: "-scheduled_pickup_at", label: "Pickup (latest)" },
  { value: "customer_name", label: "Customer A–Z" },
];

export function OrdersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canOperate } = usePermissions();
  const { params, update, setPage } = useListParams({ search: searchParams.get("search") ?? "", sort: "-created_at", status: "" });
  const [editing, setEditing] = useState<Order | null | undefined>(undefined);
  const [statusFor, setStatusFor] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);

  const list = useQuery({ queryKey: ["orders", params], queryFn: () => ordersService.list(params), placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: ["orders", "summary"], queryFn: ordersService.summary });
  const counts = Object.fromEntries((summary.data?.data ?? []).map((s) => [s.status, s.count]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const remove = useApiMutation(() => ordersService.remove(deleting!.id), { invalidate: [["orders"], ["dashboard"]], onSuccess: () => setDeleting(null) });

  return (
    <>
      <PageHeader
        title="Orders"
        description="Create, track and manage customer transport orders."
        actions={
          canOperate && (
            <Button onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" /> Create Order
            </Button>
          )
        }
      />

      <Card>
        <Tabs
          className="px-4 pt-2"
          value={(params.status as string) || "all"}
          onChange={(v) => update({ status: v === "all" ? "" : v })}
          tabs={[{ value: "all", label: "All", count: summary.data ? total : undefined }, ...statusOptions(ORDER_STATUS).map((o) => ({ ...o, count: counts[o.value] }))]}
        />
        <div className="flex flex-col gap-3 p-4 sm:flex-row">
          <SearchInput
            value={(params.search as string) ?? ""}
            onChange={(search) => update({ search })}
            placeholder="Search order no., customer, address, cargo…"
            className="flex-1"
          />
          <Select value={params.sort as string} onChange={(e) => update({ sort: e.target.value })} options={SORTS} className="sm:w-52" aria-label="Sort orders" />
        </div>

        <DataTable
          rows={list.data?.data}
          loading={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(o) => o.id}
          sort={params.sort as string}
          onSortChange={(sort) => update({ sort })}
          onRowClick={(o) => router.push(`/orders/${o.id}`)}
          empty={{ title: "No orders found", description: "Try a different search or status filter." }}
          columns={[
            { key: "order_number", header: "Order No.", sortKey: "order_number", cell: (o) => <span className="font-semibold text-ink-900">{o.order_number}</span> },
            {
              key: "customer",
              header: "Customer",
              sortKey: "customer_name",
              cell: (o) => (
                <span>
                  <span className="block font-medium text-ink-900">{o.customer_name}</span>
                  <span className="text-xs text-ink-500">{o.customer_contact}</span>
                </span>
              ),
            },
            {
              key: "route",
              header: "Pickup → Delivery",
              cell: (o) => (
                <span className="block max-w-72 text-xs">
                  <span className="line-clamp-1 max-w-56 whitespace-normal">{o.pickup_address}</span>
                  <span className="line-clamp-1 max-w-56 whitespace-normal text-ink-500">→ {o.delivery_address}</span>
                </span>
              ),
            },
            { key: "pickup", header: "Pickup", sortKey: "scheduled_pickup_at", cell: (o) => <span className="whitespace-nowrap">{formatDateTime(o.scheduled_pickup_at)}</span> },
            {
              key: "cargo",
              header: "Cargo",
              cell: (o) => (
                <span className="text-xs">
                  <span className="line-clamp-1 max-w-40 whitespace-normal">{o.cargo_description}</span>
                  <span className="text-ink-500">
                    {formatNumber(o.quantity)} pcs{o.weight_kg ? ` · ${formatNumber(o.weight_kg)} kg` : ""}
                  </span>
                </span>
              ),
            },
            {
              key: "assigned",
              header: "Assigned",
              cell: (o) =>
                o.vehicle ? (
                  <span className="text-xs">
                    <span className="block font-medium text-ink-900">{o.vehicle.plate_number}</span>
                    <span className="text-ink-500">{o.driver?.full_name}</span>
                  </span>
                ) : (
                  <span className="text-xs text-ink-400">Unassigned</span>
                ),
            },
            { key: "status", header: "Status", sortKey: "status", cell: (o) => <StatusBadge status={o.status} map={ORDER_STATUS} /> },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              className: "text-right",
              cell: (o) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <Dropdown
                    trigger={({ toggle }) => (
                      <button onClick={toggle} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800" aria-label={`Actions for ${o.order_number}`}>
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    )}
                    items={[
                      { label: "View details", icon: <Eye />, onSelect: () => router.push(`/orders/${o.id}`) },
                      ...(canOperate
                        ? [
                            { label: "Edit", icon: <Pencil />, onSelect: () => setEditing(o), disabled: ["delivered", "cancelled"].includes(o.status) },
                            { label: "Change status", icon: <RefreshCcw />, onSelect: () => setStatusFor(o), disabled: o.allowed_transitions.length === 0 },
                            {
                              label: "Cancel order",
                              icon: <Ban />,
                              onSelect: () => setStatusFor(o),
                              disabled: !o.allowed_transitions.includes("cancelled" as OrderStatus),
                            },
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
        <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="orders" />
      </Card>

      <OrderFormModal open={editing !== undefined} order={editing} onClose={() => setEditing(undefined)} />
      <OrderStatusDialog order={statusFor} onClose={() => setStatusFor(null)} />
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
