"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, ClipboardList, Package, Route, Timer, Truck, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActivityChart } from "@/components/charts/activity-chart";
import { StatusDonut } from "@/components/charts/status-donut";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { DRIVER_STATUS, ORDER_STATUS, TRIP_STATUS, VEHICLE_STATUS } from "@/lib/constants";
import { formatDateTime, formatNumber, formatTime } from "@/lib/utils";
import { dashboardService } from "@/services/resources";

const RANGES = [7, 14, 30];

export function DashboardView() {
  const [days, setDays] = useState(14);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard", days], queryFn: () => dashboardService.get(days), refetchInterval: 60_000 });
  const d = data?.data;
  const stats = d?.stats;

  return (
    <>
      <PageHeader title="Dashboard" description="Live overview of orders, trips, vehicles and drivers." />

      {error && !d ? (
        <Card>
          <ErrorState message={error.message} onRetry={() => refetch()} />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard label="Total Orders" value={formatNumber(stats?.total_orders)} icon={Package} loading={isLoading} />
            <StatCard label="Active Trips" value={formatNumber(stats?.active_trips)} icon={Route} tone="blue" hint="Dispatched or on the road" loading={isLoading} />
            <StatCard
              label="Available Vehicles"
              value={formatNumber(stats?.available_vehicles)}
              icon={Truck}
              tone="green"
              hint={stats ? `of ${stats.total_vehicles} vehicles` : undefined}
              loading={isLoading}
            />
            <StatCard label="Total Drivers" value={formatNumber(stats?.total_drivers)} icon={Users} tone="violet" loading={isLoading} />
            <StatCard label="Pending Deliveries" value={formatNumber(stats?.pending_deliveries)} icon={Timer} tone="amber" hint="Pending, scheduled or in transit" loading={isLoading} />
            <StatCard label="Completed Trips" value={formatNumber(stats?.completed_trips)} icon={CheckCircle2} tone="green" loading={isLoading} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Orders & Trips Overview"
                icon={<BarChart3 />}
                description="Orders created and trips completed per day"
                action={
                  <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input h-9 w-auto py-0" aria-label="Date range">
                    {RANGES.map((r) => (
                      <option key={r} value={r}>
                        Last {r} days
                      </option>
                    ))}
                  </select>
                }
              />
              <CardBody>{d ? <ActivityChart data={d.activity} /> : <LoadingState />}</CardBody>
            </Card>
            <Card>
              <CardHeader title="Delivery Status" icon={<Package />} description="All orders by status" />
              <CardBody>{d ? <StatusDonut data={d.order_status} map={ORDER_STATUS} centerLabel="Orders" /> : <LoadingState />}</CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Recent Orders"
                icon={<ClipboardList />}
                action={
                  <Link href="/orders" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    View All
                  </Link>
                }
              />
              <DataTable
                rows={d?.recent_orders}
                loading={isLoading}
                rowKey={(o) => o.id}
                empty={{ title: "No orders yet", description: "New orders will appear here." }}
                columns={[
                  { key: "no", header: "Order No.", cell: (o) => <Link href={`/orders/${o.id}`} className="font-medium text-ink-900 hover:text-brand-600">{o.order_number}</Link> },
                  { key: "customer", header: "Customer", cell: (o) => o.customer_name },
                  { key: "dest", header: "Destination", cell: (o) => <span className="line-clamp-1 max-w-48 whitespace-normal">{o.delivery_address}</span> },
                  { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} map={ORDER_STATUS} /> },
                  { key: "eta", header: "Delivery", cell: (o) => <span className="whitespace-nowrap">{formatDateTime(o.scheduled_delivery_at)}</span> },
                ]}
              />
            </Card>
            <Card>
              <CardHeader
                title="Active Trips"
                icon={<Route />}
                action={
                  <Link href="/transportation/dispatch" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    Dispatch Board
                  </Link>
                }
              />
              <DataTable
                rows={d?.active_trips}
                loading={isLoading}
                rowKey={(t) => t.id}
                empty={{ title: "No active trips", description: "Dispatched and in-progress trips will appear here." }}
                columns={[
                  { key: "no", header: "Trip No.", cell: (t) => <Link href={`/transportation/itinerary/${t.id}`} className="font-medium text-ink-900 hover:text-brand-600">{t.trip_number}</Link> },
                  { key: "route", header: "Route", cell: (t) => <span className="line-clamp-1 max-w-64 whitespace-normal">{t.origin} → {t.destination}</span> },
                  { key: "vehicle", header: "Vehicle / Driver", cell: (t) => (<span><span className="block font-medium text-ink-900">{t.vehicle?.plate_number}</span><span className="text-xs text-ink-500">{t.driver?.full_name}</span></span>) },
                  { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} /> },
                  { key: "eta", header: "ETA", cell: (t) => formatTime(t.estimated_arrival_at) },
                ]}
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Fleet Availability" icon={<Truck />} action={<Link href="/fleet/monitoring" className="text-sm font-medium text-brand-600 hover:text-brand-700">Monitoring</Link>} />
              <CardBody>{d ? <StatusDonut data={d.vehicle_status} map={VEHICLE_STATUS} centerLabel="Vehicles" /> : <LoadingState />}</CardBody>
            </Card>
            <Card>
              <CardHeader title="Driver Status" icon={<Users />} action={<Link href="/fleet/drivers" className="text-sm font-medium text-brand-600 hover:text-brand-700">View Drivers</Link>} />
              <CardBody>{d ? <StatusDonut data={d.driver_status} map={DRIVER_STATUS} centerLabel="Drivers" /> : <LoadingState />}</CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
