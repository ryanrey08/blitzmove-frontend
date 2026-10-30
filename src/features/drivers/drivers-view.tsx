"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, Eye, MoreVertical, Navigation, Pencil, Plus, SlidersHorizontal, Trash2, UserCheck, UserMinus, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Dropdown } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { StatFilterCards } from "@/components/ui/stat-filter-cards";
import { useToast } from "@/components/ui/toast";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { DRIVER_STATUS, LICENSE_TYPES, VEHICLE_TYPES, labelOf, statusOptions } from "@/lib/constants";
import { exportCsv } from "@/lib/export";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/services/api-client";
import { driversService } from "@/services/resources";
import type { Driver } from "@/types/api";
import { DriverPanel } from "./driver-panel";

export const DRIVERS_PATH = "/fleet/drivers";

const CARDS = [
  {
    key: "",
    label: "Total Drivers",
    icon: Users,
    tone: "bg-brand-50 text-brand-600",
  },
  {
    key: "available",
    label: "Active Drivers",
    icon: UserCheck,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    key: "on_trip",
    label: "On Trip",
    icon: Navigation,
    tone: "bg-sky-50 text-sky-600",
  },
  {
    key: "on_leave",
    label: "On Leave",
    icon: UserMinus,
    tone: "bg-amber-50 text-amber-600",
  },
];
const SORTS = [
  { value: "full_name", label: "Name (A–Z)" },
  { value: "-full_name", label: "Name (Z–A)" },
  { value: "license_expiry", label: "License expiry (soonest)" },
  { value: "-created_at", label: "Newest first" },
  { value: "status", label: "Status" },
];
const checkboxClass = "h-4 w-4 rounded border-ink-300 accent-brand-600";
const photoOf = (d: Driver) => (d.photo ? `${api.url(d.photo)}?v=${d.updated_at}` : null);

export function DriversView() {
  const router = useRouter();
  const notify = useToast();
  const searchParams = useSearchParams();
  const { canManageFleet } = usePermissions();
  const { params, update, setPage } = useListParams({
    sort: "full_name",
    status: "",
    license_type: "",
    vehicle_type: "",
  });
  const [selected, setSelected] = useState<number | null>(Number(searchParams.get("driver")) || null);
  const [checked, setChecked] = useState<Map<number, Driver>>(new Map());
  const [moreFilters, setMoreFilters] = useState(false);
  const [deleting, setDeleting] = useState<Driver | null>(null);

  const list = useQuery({
    queryKey: ["drivers", params],
    queryFn: () => driversService.list(params),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ["drivers", "summary"],
    queryFn: driversService.summary,
  });
  const stat = (status: string) => {
    const rows = (summary.data?.data ?? []).filter((x) => !status || x.status === status);
    return {
      count: rows.reduce((a, r) => a + r.count, 0),
      current: rows.reduce((a, r) => a + r.this_month, 0),
      previous: rows.reduce((a, r) => a + r.last_month, 0),
    };
  };

  const filtered = ["status", "license_type", "vehicle_type", "search"].some((k) => params[k]);
  const clearFilters = () => update({ status: "", license_type: "", vehicle_type: "", search: "" });

  const rows = list.data?.data ?? [];
  const allChecked = rows.length > 0 && rows.every((d) => checked.has(d.id));
  const toggle = (driver: Driver) =>
    setChecked((current) => {
      const next = new Map(current);
      if (next.has(driver.id)) next.delete(driver.id);
      else next.set(driver.id, driver);
      return next;
    });
  const toggleAll = () =>
    setChecked((current) => {
      const next = new Map(current);
      rows.forEach((d) => (allChecked ? next.delete(d.id) : next.set(d.id, d)));
      return next;
    });

  const exportSelected = () => {
    const picked = [...checked.values()];
    exportCsv(
      "drivers",
      ["Driver ID", "Name", "License No.", "License Type", "License Expiry", "Contact No.", "Email", "Assigned Vehicle", "Status"],
      picked.map((d) => [
        d.employee_code,
        d.full_name,
        d.license_number,
        labelOf(LICENSE_TYPES, d.license_type),
        d.license_expiry,
        d.phone,
        d.email,
        d.assigned_vehicle?.plate_number,
        DRIVER_STATUS[d.status].label,
      ]),
    );
    notify(`Exported ${picked.length} driver${picked.length === 1 ? "" : "s"}.`);
  };

  const remove = useApiMutation(() => driversService.remove(deleting!.id), {
    invalidate: [["drivers"], ["dashboard"]],
    onSuccess: () => {
      if (selected === deleting?.id) setSelected(null);
      setChecked((current) => {
        const next = new Map(current);
        next.delete(deleting!.id);
        return next;
      });
      setDeleting(null);
    },
  });

  const edit = (d: Driver) => router.push(`${DRIVERS_PATH}/${d.id}/edit`);
  const panel = selected ? <DriverPanel key={selected} id={selected} onClose={() => setSelected(null)} onEdit={edit} canEdit={canManageFleet} /> : null;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Drivers</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">Manage your drivers, licenses, documents, and assignments.</p>
        </div>
        {canManageFleet && (
          <Button size="lg" onClick={() => router.push(`${DRIVERS_PATH}/create`)} className="min-w-36">
            <Plus className="h-5 w-5" /> Add Driver
          </Button>
        )}
      </div>

      {/* Status cards double as quick filters. */}
      <StatFilterCards
        loading={summary.isLoading}
        active={params.status as string}
        onSelect={(status) => update({ status })}
        cards={CARDS.map((card) => {
          const s = stat(card.key);
          return {
            ...card,
            count: summary.data ? s.count : undefined,
            trend: { current: s.current, previous: s.previous },
          };
        })}
      />

      {/* Filters */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
        <SearchInput
          value={(params.search as string) ?? ""}
          onChange={(search) => update({ search })}
          placeholder="Search drivers by name, license no., contact…"
          className="sm:col-span-2 lg:col-span-1"
        />
        <Select value={params.status as string} onChange={(e) => update({ status: e.target.value })} options={statusOptions(DRIVER_STATUS)} placeholder="All Status" aria-label="Filter by status" />
        <Select
          value={params.license_type as string}
          onChange={(e) => update({ license_type: e.target.value })}
          options={LICENSE_TYPES}
          placeholder="All License Type"
          aria-label="Filter by license type"
        />
        <Select
          value={params.vehicle_type as string}
          onChange={(e) => update({ vehicle_type: e.target.value })}
          options={VEHICLE_TYPES}
          placeholder="All Vehicle Type"
          aria-label="Filter by assigned vehicle type"
        />
        <Button variant="secondary" onClick={() => setMoreFilters((v) => !v)} aria-expanded={moreFilters} className="h-10">
          <SlidersHorizontal className="h-4 w-4" /> Filter
        </Button>
      </div>
      {moreFilters && (
        <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-ink-600">
            Sort by
            <Select value={params.sort as string} onChange={(e) => update({ sort: e.target.value })} options={SORTS} className="w-56" aria-label="Sort drivers" />
          </label>
          <p className="flex-1 text-xs text-ink-500">Tip: the cards above also filter the table.</p>
          <Button variant="ghost" onClick={clearFilters} disabled={!filtered}>
            Clear all filters
          </Button>
        </Card>
      )}

      <div className={cn("grid gap-5", panel && "2xl:grid-cols-[minmax(0,1fr)_420px]")}>
        <Card className="min-w-0">
          {checked.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 bg-brand-50/50 px-4 py-2.5 text-sm">
              <span className="font-medium text-ink-900">{checked.size} selected</span>
              <Button size="sm" variant="secondary" onClick={exportSelected}>
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
            rowKey={(d) => d.id}
            selectedKey={selected}
            sort={params.sort as string}
            onSortChange={(sort) => update({ sort })}
            onRowClick={(d) => setSelected(d.id)}
            empty={
              filtered
                ? {
                    title: "No drivers match your filters",
                    description: "Try a different status, license type or search.",
                    action: (
                      <Button size="sm" variant="secondary" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ),
                  }
                : {
                    title: "No drivers yet",
                    description: "Add a driver to get started.",
                  }
            }
            columns={[
              {
                key: "select",
                header: <input type="checkbox" className={checkboxClass} checked={allChecked} onChange={toggleAll} aria-label="Select all drivers on this page" />,
                headerClassName: "w-10",
                cell: (d) => (
                  <input type="checkbox" className={checkboxClass} checked={checked.has(d.id)} onChange={() => toggle(d)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${d.full_name}`} />
                ),
              },
              {
                key: "name",
                header: "Name",
                sortKey: "full_name",
                cell: (d) => (
                  <span className="flex items-center gap-3">
                    <Avatar name={d.full_name} src={photoOf(d)} size="sm" />
                    <span>
                      <span className="block font-medium whitespace-nowrap text-ink-900">{d.full_name}</span>
                      <span className="text-xs text-ink-500">{d.employee_code}</span>
                    </span>
                  </span>
                ),
              },
              {
                key: "license",
                header: "License No.",
                sortKey: "license_expiry",
                cell: (d) => (
                  <span className="whitespace-nowrap">
                    <span className="block">{d.license_number}</span>
                    <span className={cn("text-xs", d.license_expired ? "font-medium text-brand-700" : "text-ink-500")}>
                      {d.license_expired ? "Expired" : "Expires"} {formatDate(d.license_expiry)}
                    </span>
                  </span>
                ),
              },
              {
                key: "type",
                header: "License Type",
                cell: (d) => labelOf(LICENSE_TYPES, d.license_type),
              },
              {
                key: "phone",
                header: "Contact No.",
                cell: (d) => <span className="whitespace-nowrap">{d.phone}</span>,
              },
              {
                key: "vehicle",
                header: "Assigned Vehicle",
                cell: (d) =>
                  d.assigned_vehicle ? (
                    <span>
                      <span className="block font-medium whitespace-nowrap text-ink-900">{d.assigned_vehicle.plate_number}</span>
                      <span className="text-xs whitespace-nowrap text-ink-500">
                        {d.assigned_vehicle.make} {d.assigned_vehicle.model}
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-400">—</span>
                  ),
              },
              {
                key: "status",
                header: "Status",
                sortKey: "status",
                cell: (d) => <StatusBadge status={d.status} map={DRIVER_STATUS} dot={false} />,
              },
              {
                key: "actions",
                header: "Actions",
                // Pinned so the menu stays reachable when the table scrolls sideways.
                headerClassName: "sticky right-0 bg-ink-50 text-center",
                className: "sticky right-0 bg-white text-center shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
                cell: (d) => (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      trigger={({ toggle: open }) => (
                        <button onClick={open} className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900" aria-label={`Actions for ${d.full_name}`}>
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      )}
                      items={[
                        {
                          label: "View details",
                          icon: <Eye />,
                          onSelect: () => router.push(`${DRIVERS_PATH}/${d.id}`),
                        },
                        ...(canManageFleet
                          ? [
                              {
                                label: "Edit driver",
                                icon: <Pencil />,
                                onSelect: () => edit(d),
                              },
                              {
                                label: "Remove",
                                icon: <Trash2 />,
                                danger: true,
                                onSelect: () => setDeleting(d),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                ),
              },
            ]}
          />
          <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="drivers" showEdges />
        </Card>

        {panel}
      </div>

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
