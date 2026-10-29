"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, ClipboardList, MapPin, Package, Pencil, RefreshCcw, Route, Truck } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-current-user";
import { ORDER_STATUS, TRIP_STATUS } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { ordersService } from "@/services/resources";
import { OrderFormModal } from "./order-form";
import { OrderStatusDialog } from "./order-status-dialog";

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-900">{children ?? "—"}</dd>
    </div>
  );
}

export function OrderDetail({ id }: { id: number }) {
  const { canOperate } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["order", id], queryFn: () => ordersService.get(id) });
  const order = data?.data;

  if (isLoading) return <LoadingState />;
  if (error || !order) return <ErrorState message={error?.message} onRetry={() => refetch()} />;

  const editable = !["delivered", "cancelled"].includes(order.status);

  return (
    <>
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{order.order_number}</h1>
            <StatusBadge status={order.status} map={ORDER_STATUS} />
          </div>
          <p className="mt-1 text-ink-500">
            {order.customer_name} · created {formatDateTime(order.created_at)}
            {order.created_by ? ` by ${order.created_by.name}` : ""}
          </p>
        </div>
        {canOperate && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setChangingStatus(true)} disabled={order.allowed_transitions.length === 0}>
              <RefreshCcw className="h-4 w-4" /> Change status
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)} disabled={!editable}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {["pending", "scheduled"].includes(order.status) && (
              <Link href={`/transportation/trip-scheduling/create?order=${order.id}`}>
                <Button>
                  <Route className="h-4 w-4" /> Schedule trip
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Customer" icon={<ClipboardList />} />
          <CardBody>
            <dl>
              <DetailRow label="Name">{order.customer_name}</DetailRow>
              <DetailRow label="Contact">{order.customer_contact}</DetailRow>
              <DetailRow label="Instructions">{order.delivery_instructions || "—"}</DetailRow>
              {order.cancellation_reason && <DetailRow label="Cancel reason">{order.cancellation_reason}</DetailRow>}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pickup & Delivery" icon={<MapPin />} />
          <CardBody>
            <dl>
              <DetailRow label="Pickup address">{order.pickup_address}</DetailRow>
              <DetailRow label="Pickup">{formatDateTime(order.scheduled_pickup_at)}</DetailRow>
              <DetailRow label="Delivery address">{order.delivery_address}</DetailRow>
              <DetailRow label="Delivery">{formatDateTime(order.scheduled_delivery_at)}</DetailRow>
              {order.delivered_at && <DetailRow label="Delivered at">{formatDateTime(order.delivered_at)}</DetailRow>}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Cargo & Assignment" icon={<Package />} />
          <CardBody>
            <dl>
              <DetailRow label="Cargo">{order.cargo_description}</DetailRow>
              <DetailRow label="Quantity">{formatNumber(order.quantity)}</DetailRow>
              <DetailRow label="Weight">{order.weight_kg ? `${formatNumber(order.weight_kg)} kg` : "—"}</DetailRow>
              <DetailRow label="Vehicle">
                {order.vehicle ? <Link className="text-brand-600 hover:underline" href={`/fleet/vehicles/${order.vehicle.id}`}>{order.vehicle.plate_number} · {order.vehicle.make} {order.vehicle.model}</Link> : "Unassigned"}
              </DetailRow>
              <DetailRow label="Driver">{order.driver?.full_name ?? "Unassigned"}</DetailRow>
            </dl>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Trips" icon={<Truck />} description="Trips scheduled to carry this order" />
        <DataTable
          rows={order.trips}
          rowKey={(t) => t.id}
          empty={{ title: "No trips yet", description: "Schedule a trip to assign a vehicle and driver.", }}
          columns={[
            { key: "no", header: "Trip No.", cell: (t) => <Link href={`/transportation/itinerary/${t.id}`} className="font-medium text-ink-900 hover:text-brand-600">{t.trip_number}</Link> },
            { key: "route", header: "Route", cell: (t) => `${t.origin} → ${t.destination}` },
            { key: "vehicle", header: "Vehicle", cell: (t) => t.vehicle?.plate_number },
            { key: "driver", header: "Driver", cell: (t) => t.driver?.full_name },
            { key: "dep", header: "Departure", cell: (t) => (<span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CalendarClock className="h-3.5 w-3.5 text-ink-400" />{formatDateTime(t.departure_at)}</span>) },
            { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} /> },
          ]}
        />
      </Card>

      <OrderFormModal open={editing} order={order} onClose={() => setEditing(false)} onSaved={() => refetch()} />
      <OrderStatusDialog order={changingStatus ? order : null} onClose={() => setChangingStatus(false)} />
    </>
  );
}
