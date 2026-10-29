"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, ClipboardList, CreditCard, Hash, MapPin, Navigation, Package, Phone, Receipt, Truck, UserRound, Weight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { ORDER_STATUS } from "@/lib/constants";
import { cn, formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";
import { ordersService } from "@/services/resources";
import type { Order } from "@/types/api";

/** Right-hand order summary on the Orders page (a drawer on narrower screens). */
export function OrderPanel({ id, canEdit, onEdit, onClose }: { id: number; canEdit: boolean; onEdit: (order: Order) => void; onClose: () => void }) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["order", id], queryFn: () => ordersService.get(id) });
  const order = data?.data;
  const trip = order?.trips?.[0];

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card" aria-label="Order details">
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <ClipboardList className="h-5 w-5" /> Order Details
        </h2>
        <div className="flex items-center gap-1">
          {canEdit && order && !["delivered", "cancelled"].includes(order.status) && (
            <Button size="sm" onClick={() => onEdit(order)}>
              Edit Order
            </Button>
          )}
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="Close order details">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error || !order ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : (
        <>
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-bold text-ink-900">{order.order_number}</p>
              <StatusBadge status={order.status} map={ORDER_STATUS} dot={false} />
              {order.is_delayed && <Badge tone="red">Delayed</Badge>}
            </div>

            <Item icon={<UserRound />} label="Customer">
              <p className="font-semibold text-ink-900">{order.customer_name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-ink-600">
                <Phone className="h-3.5 w-3.5" /> {order.customer_contact}
              </p>
            </Item>
            <Item icon={<MapPin className="text-emerald-600" />} label="Pickup Location">
              <p className="text-ink-800">{order.pickup_address}</p>
              <p className="text-xs text-ink-500">Scheduled: {formatDateTime(order.scheduled_pickup_at)}</p>
            </Item>
            <Item icon={<MapPin className="text-brand-600" />} label="Delivery Location">
              <p className="text-ink-800">{order.delivery_address}</p>
              <p className="text-xs text-ink-500">
                Scheduled: {formatDateTime(order.scheduled_delivery_at)}
                {order.delivered_at && ` · Delivered ${formatDateTime(order.delivered_at)}`}
              </p>
            </Item>

            <div className="grid grid-cols-3 gap-3">
              <Item icon={<Package />} label="Cargo" compact>
                <p className="text-ink-800">{order.cargo_description}</p>
              </Item>
              <Item icon={<Boxes />} label="Quantity" compact>
                <p className="text-ink-800">{formatNumber(order.quantity)} units</p>
              </Item>
              <Item icon={<Weight />} label="Weight" compact>
                <p className="text-ink-800">{order.weight_kg ? `${formatNumber(order.weight_kg)} kg` : "—"}</p>
              </Item>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Item icon={<Truck />} label="Vehicle Assigned" compact>
                {order.vehicle ? (
                  <>
                    <p className="font-semibold text-ink-900">{order.vehicle.plate_number}</p>
                    <p className="text-xs text-ink-500">
                      {order.vehicle.make} {order.vehicle.model}
                    </p>
                  </>
                ) : (
                  <p className="text-ink-400">Not assigned</p>
                )}
              </Item>
              <Item icon={<UserRound />} label="Driver" compact>
                {order.driver ? (
                  <>
                    <p className="font-semibold text-ink-900">{order.driver.full_name}</p>
                    <p className="text-xs text-ink-500">{order.driver.phone}</p>
                  </>
                ) : (
                  <p className="text-ink-400">Not assigned</p>
                )}
              </Item>
              <Item icon={<Receipt />} label="Order Amount" compact>
                <p className="text-base font-bold text-ink-900">{order.amount != null ? formatCurrency(order.amount) : "—"}</p>
              </Item>
              <Item icon={<CreditCard />} label="Payment Terms" compact>
                <p className="text-ink-800">{order.payment_terms ?? "—"}</p>
              </Item>
            </div>

            {order.cancellation_reason && (
              <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">Cancelled: {order.cancellation_reason}</p>
            )}
            {trip && (
              <p className="flex items-center gap-1.5 text-xs text-ink-500">
                <Hash className="h-3.5 w-3.5" /> Latest trip {trip.trip_number}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-ink-100 p-4">
            <Button variant="secondary" disabled={!trip} title={trip ? undefined : "No trip scheduled for this order yet"} onClick={() => trip && router.push(`/transportation/trip-scheduling/${trip.id}`)}>
              View Trip
            </Button>
            <Button onClick={() => router.push(`/orders/${order.id}`)}>
              <Navigation className="h-4 w-4" /> Track Order
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}

function Item({ icon, label, compact, children }: { icon: ReactNode; label: string; compact?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn("mt-0.5 shrink-0 text-ink-700 [&>svg]:h-5 [&>svg]:w-5", compact && "[&>svg]:h-4 [&>svg]:w-4")}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        {children}
      </div>
    </div>
  );
}
