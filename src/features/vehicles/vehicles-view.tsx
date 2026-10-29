"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, Eye, MoreVertical, Pencil, Plus, Trash2, Truck, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { StatCard } from "@/components/ui/stat-card";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { VEHICLE_STATUS, VEHICLE_TYPES, labelOf, statusOptions } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { vehiclesService } from "@/services/resources";
import type { Vehicle } from "@/types/api";

export function VehiclesView() {
  const router = useRouter();
  const { canManageFleet } = usePermissions();
  const { params, update, setPage } = useListParams({ sort: "plate_number", status: "", vehicle_type: "" });
  const [deleting, setDeleting] = useState<Vehicle | null>(null);

  const list = useQuery({ queryKey: ["vehicles", params], queryFn: () => vehiclesService.list(params), placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: ["vehicles", "summary"], queryFn: vehiclesService.summary });
  const count = (s: string) => summary.data?.data.find((x) => x.status === s)?.count ?? 0;
  const total = summary.data?.data.reduce((a, b) => a + b.count, 0) ?? 0;

  const remove = useApiMutation(() => vehiclesService.remove(deleting!.id), { invalidate: [["vehicles"], ["dashboard"]], onSuccess: () => setDeleting(null) });

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Manage your fleet, capacities and regular driver assignments."
        actions={
          canManageFleet && (
            <Button onClick={() => router.push("/fleet/vehicles/create")}>
              <Plus className="h-4 w-4" /> Add Vehicle
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Vehicles" value={total} icon={Truck} loading={summary.isLoading} />
        <StatCard label="Available" value={count("available")} icon={Truck} tone="green" loading={summary.isLoading} />
        <StatCard label="On Trip" value={count("on_trip")} icon={Truck} tone="blue" loading={summary.isLoading} />
        <StatCard label="In Maintenance" value={count("maintenance")} icon={Wrench} tone="amber" loading={summary.isLoading} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 p-4 md:flex-row">
          <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search plate, make, model, VIN, driver…" className="flex-1" />
          <Select value={params.status as string} onChange={(e) => update({ status: e.target.value })} options={statusOptions(VEHICLE_STATUS)} placeholder="All statuses" className="md:w-44" aria-label="Filter by status" />
          <Select value={params.vehicle_type as string} onChange={(e) => update({ vehicle_type: e.target.value })} options={VEHICLE_TYPES} placeholder="All vehicle types" className="md:w-48" aria-label="Filter by type" />
        </div>
        <DataTable
          rows={list.data?.data}
          loading={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(v) => v.id}
          sort={params.sort as string}
          onSortChange={(sort) => update({ sort })}
          onRowClick={(v) => router.push(`/fleet/vehicles/${v.id}`)}
          empty={{ title: "No vehicles found", description: "Adjust the filters or add a vehicle." }}
          columns={[
            { key: "plate", header: "Plate No.", sortKey: "plate_number", cell: (v) => <span className="font-semibold text-ink-900">{v.plate_number}</span> },
            {
              key: "vehicle",
              header: "Make / Model",
              sortKey: "make",
              cell: (v) => (
                <span>
                  <span className="block font-medium text-ink-900">
                    {v.make} {v.model}
                  </span>
                  <span className="text-xs text-ink-500">{labelOf(VEHICLE_TYPES, v.vehicle_type)}</span>
                </span>
              ),
            },
            { key: "year", header: "Year", sortKey: "year", cell: (v) => v.year },
            { key: "capacity", header: "Capacity", sortKey: "capacity_kg", cell: (v) => (v.capacity_kg ? `${formatNumber(v.capacity_kg)} kg` : "—") },
            { key: "driver", header: "Assigned Driver", cell: (v) => v.assigned_driver?.full_name ?? <span className="text-ink-400">—</span> },
            { key: "trip", header: "Current Trip", cell: (v) => v.active_trip?.trip_number ?? <span className="text-ink-400">—</span> },
            { key: "status", header: "Status", sortKey: "status", cell: (v) => <StatusBadge status={v.status} map={VEHICLE_STATUS} /> },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              className: "text-right",
              cell: (v) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <Dropdown
                    trigger={({ toggle }) => (
                      <button onClick={toggle} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Actions for ${v.plate_number}`}>
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    )}
                    items={[
                      { label: "View details", icon: <Eye />, onSelect: () => router.push(`/fleet/vehicles/${v.id}`) },
                      ...(canManageFleet
                        ? [
                            { label: "Edit", icon: <Pencil />, onSelect: () => router.push(`/fleet/vehicles/${v.id}/edit`) },
                            { label: "Remove", icon: v.active_trip ? <Ban /> : <Trash2 />, danger: true, onSelect: () => setDeleting(v) },
                          ]
                        : []),
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
        <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="vehicles" />
      </Card>

      <ConfirmDialog
        open={!!deleting}
        title="Remove vehicle"
        message={
          <>
            Remove <strong>{deleting?.plate_number}</strong> from the fleet? Vehicles with scheduled or active trips cannot be removed. History is kept.
          </>
        }
        confirmLabel="Remove vehicle"
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
