"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MoreVertical, Pencil, Navigation, Plus, Trash2, UserCheck, UserMinus, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
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
import { DRIVER_STATUS, LICENSE_TYPES, VEHICLE_TYPES, labelOf, statusOptions } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { driversService } from "@/services/resources";
import type { Driver } from "@/types/api";
import { DriverFormModal } from "./driver-form";
import { DriverPanel } from "./driver-panel";

export function DriversView() {
  const searchParams = useSearchParams();
  const { canManageFleet } = usePermissions();
  const { params, update, setPage } = useListParams({ sort: "full_name", status: "", license_type: "", vehicle_type: "" });
  const [selected, setSelected] = useState<number | null>(Number(searchParams.get("driver")) || null);
  const [editing, setEditing] = useState<Driver | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Driver | null>(null);

  const list = useQuery({ queryKey: ["drivers", params], queryFn: () => driversService.list(params), placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: ["drivers", "summary"], queryFn: driversService.summary });
  const count = (s: string) => summary.data?.data.find((x) => x.status === s)?.count ?? 0;
  const total = summary.data?.data.reduce((a, b) => a + b.count, 0) ?? 0;

  const remove = useApiMutation(() => driversService.remove(deleting!.id), {
    invalidate: [["drivers"], ["dashboard"]],
    onSuccess: () => {
      if (selected === deleting?.id) setSelected(null);
      setDeleting(null);
    },
  });

  return (
    <>
      <PageHeader
        title="Drivers"
        description="Manage your drivers, licenses, documents, and assignments."
        actions={
          canManageFleet && (
            <Button onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" /> Add Driver
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Drivers" value={total} icon={Users} loading={summary.isLoading} />
        <StatCard label="Available" value={count("available")} icon={UserCheck} tone="green" loading={summary.isLoading} />
        <StatCard label="On Trip" value={count("on_trip")} icon={Navigation} tone="blue" loading={summary.isLoading} />
        <StatCard label="On Leave" value={count("on_leave")} icon={UserMinus} tone="amber" loading={summary.isLoading} />
      </div>

      <div className={cn("grid gap-6", selected && "2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]")}>
        <Card className="min-w-0">
          <div className="flex flex-col gap-3 p-4 lg:flex-row">
            <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search name, license no., contact…" className="flex-1" />
            <Select value={params.status as string} onChange={(e) => update({ status: e.target.value })} options={statusOptions(DRIVER_STATUS)} placeholder="All Status" className="lg:w-40" aria-label="Filter by status" />
            <Select value={params.license_type as string} onChange={(e) => update({ license_type: e.target.value })} options={LICENSE_TYPES} placeholder="All License Type" className="lg:w-44" aria-label="Filter by license type" />
            <Select value={params.vehicle_type as string} onChange={(e) => update({ vehicle_type: e.target.value })} options={VEHICLE_TYPES} placeholder="All Vehicle Type" className="lg:w-44" aria-label="Filter by assigned vehicle type" />
          </div>
          <DataTable
            rows={list.data?.data}
            loading={list.isFetching}
            error={list.error}
            onRetry={() => list.refetch()}
            rowKey={(d) => d.id}
            selectedKey={selected}
            sort={params.sort as string}
            onSortChange={(sort) => update({ sort })}
            onRowClick={(d) => setSelected(d.id)}
            empty={{ title: "No drivers found", description: "Adjust the filters or add a driver." }}
            columns={[
              {
                key: "name",
                header: "Name",
                sortKey: "full_name",
                cell: (d) => (
                  <span className="flex items-center gap-3">
                    <Avatar name={d.full_name} size="sm" />
                    <span className="font-medium whitespace-nowrap text-ink-900">{d.full_name}</span>
                  </span>
                ),
              },
              { key: "license", header: "License No.", cell: (d) => <span className="whitespace-nowrap">{d.license_number}</span> },
              { key: "type", header: "License Type", cell: (d) => labelOf(LICENSE_TYPES, d.license_type) },
              {
                key: "expiry",
                header: "Expiry",
                sortKey: "license_expiry",
                cell: (d) => <span className={cn("whitespace-nowrap", d.license_expired && "font-medium text-brand-700")}>{formatDate(d.license_expiry)}</span>,
              },
              { key: "phone", header: "Contact No.", cell: (d) => <span className="whitespace-nowrap">{d.phone}</span> },
              {
                key: "vehicle",
                header: "Assigned Vehicle",
                cell: (d) =>
                  d.assigned_vehicle ? (
                    <span>
                      <span className="block font-medium text-ink-900">{d.assigned_vehicle.plate_number}</span>
                      <span className="text-xs text-ink-500">
                        {d.assigned_vehicle.make} {d.assigned_vehicle.model}
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-400">—</span>
                  ),
              },
              { key: "status", header: "Status", sortKey: "status", cell: (d) => <StatusBadge status={d.status} map={DRIVER_STATUS} /> },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                cell: (d) =>
                  canManageFleet && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={({ toggle }) => (
                          <button onClick={toggle} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Actions for ${d.full_name}`}>
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        )}
                        items={[
                          { label: "Edit", icon: <Pencil />, onSelect: () => setEditing(d) },
                          { label: "Remove", icon: <Trash2 />, danger: true, onSelect: () => setDeleting(d) },
                        ]}
                      />
                    </div>
                  ),
              },
            ]}
          />
          <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="drivers" />
        </Card>

        {selected && <DriverPanel id={selected} onClose={() => setSelected(null)} onEdit={setEditing} canEdit={canManageFleet} />}
      </div>

      <DriverFormModal open={editing !== undefined} driver={editing} onClose={() => setEditing(undefined)} />
      <ConfirmDialog
        open={!!deleting}
        title="Remove driver"
        message={
          <>
            Remove <strong>{deleting?.full_name}</strong>? Drivers with scheduled or active trips cannot be removed. Trip history is kept.
          </>
        }
        confirmLabel="Remove driver"
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
