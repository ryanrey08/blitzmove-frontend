"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Banknote, Droplets, Fuel, Gauge, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { FUEL_TYPES, labelOf } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";
import { fuelService } from "@/services/resources";
import type { FuelRecord } from "@/types/api";
import { FUEL_PATH } from "./fuel-editor";
import { useFleetOptions } from "./use-fleet-options";

export function FuelView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canOperate } = usePermissions();
  const { vehicleOptions } = useFleetOptions();
  const { params, update, setPage } = useListParams({ sort: "-fueled_at", vehicle_id: searchParams.get("vehicle") ?? "", fuel_type: "", from: "", to: "" });
  const [deleting, setDeleting] = useState<FuelRecord | null>(null);

  const filters = { ...params, page: undefined, per_page: undefined, sort: undefined };
  const list = useQuery({ queryKey: ["fuel", params], queryFn: () => fuelService.list(params), placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: ["fuel", "summary", filters], queryFn: () => fuelService.summary(filters), placeholderData: keepPreviousData });
  const s = summary.data?.data;

  const remove = useApiMutation(() => fuelService.remove(deleting!.id), { invalidate: [["fuel"]], onSuccess: () => setDeleting(null) });

  return (
    <>
      <PageHeader
        title="Fuel Management"
        description="Fuel purchases, consumption and expense per vehicle."
        actions={
          canOperate && (
            <Button onClick={() => router.push(params.vehicle_id ? `${FUEL_PATH}/create?vehicle=${params.vehicle_id}` : `${FUEL_PATH}/create`)}>
              <Plus className="h-4 w-4" /> Add Fuel Transaction
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Fuel Entries" value={formatNumber(s?.entries)} icon={Fuel} loading={summary.isLoading} hint="Matching current filters" />
        <StatCard label="Total Liters" value={s ? `${formatNumber(s.total_liters, 2)} L` : "—"} icon={Droplets} tone="blue" loading={summary.isLoading} />
        <StatCard label="Total Expense" value={formatCurrency(s?.total_cost)} icon={Banknote} tone="green" loading={summary.isLoading} />
        <StatCard label="Avg. Price / Liter" value={s?.average_price_per_liter ? formatCurrency(s.average_price_per_liter) : "—"} icon={Gauge} tone="amber" loading={summary.isLoading} />
      </div>

      <Card>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_15rem_10rem_10rem_10rem]">
          <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search station, receipt, reference, plate, driver…" />
          <Select value={params.vehicle_id as string} onChange={(e) => update({ vehicle_id: e.target.value })} options={vehicleOptions} placeholder="All vehicles" aria-label="Filter by vehicle" />
          <Select value={params.fuel_type as string} onChange={(e) => update({ fuel_type: e.target.value })} options={FUEL_TYPES} placeholder="All fuel types" aria-label="Filter by fuel type" />
          <Input type="date" value={params.from as string} onChange={(e) => update({ from: e.target.value })} aria-label="From date" />
          <Input type="date" value={params.to as string} onChange={(e) => update({ to: e.target.value })} aria-label="To date" />
        </div>
        <DataTable
          rows={list.data?.data}
          loading={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(r) => r.id}
          sort={params.sort as string}
          onSortChange={(sort) => update({ sort })}
          empty={{ title: "No fuel records", description: "Fuel purchases you log will appear here." }}
          columns={[
            { key: "date", header: "Date", sortKey: "fueled_at", cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.fueled_at)}</span> },
            {
              key: "vehicle",
              header: "Vehicle",
              cell: (r) =>
                r.vehicle ? (
                  <Link href={`/fleet/vehicles/${r.vehicle.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                    {r.vehicle.plate_number}
                  </Link>
                ) : (
                  "—"
                ),
            },
            { key: "driver", header: "Driver", cell: (r) => r.driver?.full_name ?? "—" },
            { key: "type", header: "Fuel", cell: (r) => labelOf(FUEL_TYPES, r.fuel_type) },
            { key: "liters", header: "Liters", sortKey: "liters", className: "text-right tabular-nums", headerClassName: "text-right", cell: (r) => formatNumber(r.liters, 2) },
            { key: "price", header: "₱ / L", className: "text-right tabular-nums", headerClassName: "text-right", cell: (r) => formatNumber(r.price_per_liter, 2) },
            { key: "total", header: "Total", sortKey: "total_cost", className: "text-right font-medium tabular-nums text-ink-900", headerClassName: "text-right", cell: (r) => formatCurrency(r.total_cost) },
            { key: "odo", header: "Odometer", className: "text-right tabular-nums", headerClassName: "text-right", cell: (r) => (r.odometer_km ? `${formatNumber(r.odometer_km)} km` : "—") },
            { key: "station", header: "Station / Receipt", cell: (r) => (<span className="text-xs"><span className="block text-ink-800">{r.station ?? "—"}</span><span className="text-ink-500">{r.receipt_number}</span></span>) },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              cell: (r) =>
                canOperate && (
                  <span className="flex gap-1">
                    <button onClick={() => router.push(`${FUEL_PATH}/${r.id}/edit`)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Edit fuel record">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleting(r)} className="rounded-md p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-700" aria-label="Delete fuel record">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                ),
            },
          ]}
        />
        <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="records" />
      </Card>

      <ConfirmDialog
        open={!!deleting}
        title="Delete fuel record"
        message={`Delete the ${deleting ? formatNumber(deleting.liters, 2) : ""} L entry for ${deleting?.vehicle?.plate_number ?? "this vehicle"}?`}
        confirmLabel="Delete"
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
