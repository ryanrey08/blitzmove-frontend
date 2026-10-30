"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, Eye, FileText, Pencil, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { DRIVER_DOCUMENT_TYPES, EXPIRY_STATUS, VEHICLE_DOCUMENT_TYPES, labelOf, statusOptions } from "@/lib/constants";
import { formatDate, formatFileSize } from "@/lib/utils";
import { documentsService } from "@/services/resources";
import type { DocumentOwner, FleetDocument } from "@/types/api";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { DOCUMENTS_PATH } from "./document-editor";

export function DocumentsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canOperate } = usePermissions();
  const [owner, setOwner] = useState<DocumentOwner>(searchParams.get("owner") === "driver" ? "driver" : "vehicle");
  const { vehicleOptions, driverOptions } = useFleetOptions();
  const { params, update, setPage } = useListParams({ sort: "expires_at", owner_id: searchParams.get("id") ?? "", document_type: "", expiry_status: "" });
  const [deleting, setDeleting] = useState<FleetDocument | null>(null);

  const list = useQuery({ queryKey: ["documents", owner, params], queryFn: () => documentsService.list(owner, params), placeholderData: keepPreviousData });
  const remove = useApiMutation(() => documentsService.remove(owner, deleting!.id), { invalidate: [["documents"], ["monitoring"]], onSuccess: () => setDeleting(null) });

  const types = owner === "vehicle" ? VEHICLE_DOCUMENT_TYPES : DRIVER_DOCUMENT_TYPES;

  return (
    <>
      <PageHeader
        title="Documents"
        description="Registrations, insurance, licenses and permits with expiry tracking."
        actions={
          canOperate && (
            <Button onClick={() => router.push(`${DOCUMENTS_PATH}/upload?owner=${owner}${params.owner_id ? `&id=${params.owner_id}` : ""}`)}>
              <Upload className="h-4 w-4" /> Upload Document
            </Button>
          )
        }
      />

      <Card>
        <Tabs
          className="px-4 pt-2"
          value={owner}
          onChange={(value) => {
            setOwner(value);
            update({ owner_id: "", document_type: "" });
          }}
          tabs={[
            { value: "vehicle", label: "Vehicle Documents" },
            { value: "driver", label: "Driver Documents" },
          ]}
        />
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_15rem_12rem_12rem]">
          <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search name, number, authority, file, owner…" />
          <Select
            value={params.owner_id as string}
            onChange={(e) => update({ owner_id: e.target.value })}
            options={owner === "vehicle" ? vehicleOptions : driverOptions}
            placeholder={owner === "vehicle" ? "All vehicles" : "All drivers"}
            aria-label="Filter by owner"
          />
          <Select value={params.document_type as string} onChange={(e) => update({ document_type: e.target.value })} options={types} placeholder="All document types" aria-label="Filter by type" />
          <Select value={params.expiry_status as string} onChange={(e) => update({ expiry_status: e.target.value })} options={statusOptions(EXPIRY_STATUS)} placeholder="Any expiry status" aria-label="Filter by expiry" />
        </div>
        <DataTable
          rows={list.data?.data}
          loading={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(d) => d.id}
          sort={params.sort as string}
          onSortChange={(sort) => update({ sort })}
          onRowClick={(d) => router.push(`${DOCUMENTS_PATH}/${owner}/${d.id}`)}
          empty={{ title: "No documents", description: "Uploaded documents will be listed here." }}
          columns={[
            {
              key: "title",
              header: "Document",
              sortKey: "title",
              cell: (d) => (
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-ink-900">{d.title}</span>
                    <span className="text-xs text-ink-500">{d.document_number ?? "No number"}</span>
                  </span>
                </span>
              ),
            },
            { key: "owner", header: owner === "vehicle" ? "Vehicle" : "Driver", cell: (d) => d.vehicle?.plate_number ?? d.driver?.full_name ?? "—" },
            { key: "type", header: "Type", sortKey: "document_type", cell: (d) => labelOf(types, d.document_type) },
            { key: "issued", header: "Issued", cell: (d) => formatDate(d.issued_at) },
            { key: "expires", header: "Expires", sortKey: "expires_at", cell: (d) => <span className="whitespace-nowrap">{formatDate(d.expires_at)}</span> },
            { key: "status", header: "Expiry Status", cell: (d) => <StatusBadge status={d.expiry_status} map={EXPIRY_STATUS} /> },
            {
              key: "file",
              header: "Files",
              cell: (d) => {
                const [first, ...rest] = d.files ?? [];
                return first ? (
                  <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <a href={documentsService.fileUrl(first, true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
                      <Download className="h-4 w-4" />
                      <span className="max-w-32 truncate">{first.original_name}</span>
                      <span className="text-xs text-ink-400">{formatFileSize(first.file_size)}</span>
                    </a>
                    {rest.length > 0 && (
                      <Link href={`${DOCUMENTS_PATH}/${owner}/${d.id}`} className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600 hover:bg-ink-200">
                        +{rest.length}
                      </Link>
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-ink-400">No file</span>
                );
              },
            },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              cell: (d) => (
                <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Link href={`${DOCUMENTS_PATH}/${owner}/${d.id}`} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`View ${d.title}`} title="View details">
                    <Eye className="h-4 w-4" />
                  </Link>
                  {canOperate && (
                    <>
                      <button onClick={() => router.push(`${DOCUMENTS_PATH}/${owner}/${d.id}/edit`)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Edit ${d.title}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleting(d)} className="rounded-md p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-700" aria-label={`Delete ${d.title}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </span>
              ),
            },
          ]}
        />
        <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="documents" />
      </Card>

      <ConfirmDialog
        open={!!deleting}
        title="Delete document"
        message={`Delete “${deleting?.title}”?`}
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
