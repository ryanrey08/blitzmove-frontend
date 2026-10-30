"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Eye, FileText, Files, Pencil, Truck, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BackLink, DetailPageState } from "@/components/ui/detail-page";
import { usePermissions } from "@/hooks/use-current-user";
import { DOCUMENT_GROUPS, DRIVER_DOCUMENT_TYPES, EXPIRY_STATUS, VEHICLE_DOCUMENT_TYPES, labelOf } from "@/lib/constants";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/utils";
import { documentsService } from "@/services/resources";
import type { DocumentFile, DocumentOwner } from "@/types/api";
import { AssignedVehicleCard, DriverLinkCard } from "../drivers/driver-panel";
import { DetailRow } from "../orders/order-detail";
import { DOCUMENTS_PATH } from "./document-editor";

const isImage = (f: DocumentFile) => (f.mime_type ? f.mime_type.startsWith("image/") : /\.(jpe?g|png|webp)$/i.test(f.original_name));
const isPdf = (f: DocumentFile) => f.mime_type === "application/pdf" || /\.pdf$/i.test(f.original_name);

/** `/fleet/documents/[owner]/[id]`: one vehicle or driver document with its owner and files. */
export function DocumentDetail({ owner, id }: { owner: DocumentOwner; id: number }) {
  const { canOperate } = usePermissions();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["documents", owner, id, "detail"], queryFn: () => documentsService.get(owner, id).then((r) => r.data) });
  const d = data;
  const listHref = `${DOCUMENTS_PATH}?owner=${owner}`;

  if (isLoading || error || !d)
    return <DetailPageState loading={isLoading} error={error} onRetry={() => refetch()} backHref={listHref} backLabel="Back to documents" noun="document" />;

  const categories = owner === "vehicle" ? VEHICLE_DOCUMENT_TYPES : DRIVER_DOCUMENT_TYPES;
  const group = DOCUMENT_GROUPS[owner].find((g) => g.categories.includes(d.document_type));
  const files = d.files ?? [];

  return (
    <>
      <BackLink href={listHref}>Back to documents</BackLink>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <FileText className="h-8 w-8" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold break-words text-ink-900 sm:text-3xl">{d.title}</h1>
              <StatusBadge status={d.expiry_status} map={EXPIRY_STATUS} />
            </div>
            <p className="text-ink-500">
              {labelOf(categories, d.document_type)} · {owner === "vehicle" ? "Vehicle document" : "Driver document"}
            </p>
          </div>
        </div>
        {canOperate && (
          <Button variant="secondary" onClick={() => router.push(`${DOCUMENTS_PATH}/${owner}/${d.id}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit document
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Document Information" icon={<FileText />} />
          <CardBody className="grid gap-x-8 xl:grid-cols-2">
            <dl>
              <DetailRow label="Document type">{group?.label ?? "—"}</DetailRow>
              <DetailRow label="Category">{labelOf(categories, d.document_type)}</DetailRow>
              <DetailRow label="Document No.">{d.document_number ?? "—"}</DetailRow>
              <DetailRow label="Issuing authority">{d.issuing_authority ?? "—"}</DetailRow>
            </dl>
            <dl>
              <DetailRow label="Issue date">{formatDate(d.issued_at)}</DetailRow>
              <DetailRow label="Expiry date">{formatDate(d.expires_at)}</DetailRow>
              <DetailRow label="Expiry status">
                <StatusBadge status={d.expiry_status} map={EXPIRY_STATUS} />
              </DetailRow>
              <DetailRow label="Uploaded">
                {formatDateTime(d.created_at)}
                {d.uploaded_by ? ` by ${d.uploaded_by.name}` : ""}
              </DetailRow>
            </dl>
            {d.notes && (
              <dl className="xl:col-span-2">
                <DetailRow label="Notes">
                  <span className="whitespace-pre-line">{d.notes}</span>
                </DetailRow>
              </dl>
            )}
          </CardBody>
        </Card>

        <Card>
          {owner === "vehicle" ? (
            <>
              <CardHeader title="Vehicle" icon={<Truck />} />
              <CardBody>
                <AssignedVehicleCard vehicle={d.vehicle} empty="Vehicle not found." />
              </CardBody>
            </>
          ) : (
            <>
              <CardHeader title="Driver" icon={<User />} />
              <CardBody>
                <DriverLinkCard driver={d.driver} empty="Driver not found." />
              </CardBody>
            </>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Files" icon={<Files />} description={files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : undefined} />
        <CardBody>
          {files.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {files.map((f) => (
                <li key={f.id} className="overflow-hidden rounded-lg border border-ink-100">
                  <a href={documentsService.fileUrl(f)} target="_blank" rel="noopener" className="block bg-ink-50" aria-label={`View ${f.original_name}`}>
                    {isImage(f) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- served by the API
                      <img src={documentsService.fileUrl(f)} alt={f.original_name} className="h-40 w-full object-contain" />
                    ) : (
                      <span className="flex h-40 flex-col items-center justify-center gap-1 text-ink-500">
                        <FileText className={isPdf(f) ? "h-10 w-10 text-brand-600" : "h-10 w-10"} />
                        <span className="text-xs font-semibold">{isPdf(f) ? "PDF" : "FILE"}</span>
                      </span>
                    )}
                  </a>
                  <div className="flex items-center gap-2 border-t border-ink-100 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{f.original_name}</p>
                      <p className="text-xs text-ink-500">
                        {formatFileSize(f.file_size)} · {formatDate(f.created_at)}
                      </p>
                    </div>
                    <a href={documentsService.fileUrl(f)} target="_blank" rel="noopener" className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Open ${f.original_name}`}>
                      <Eye className="h-4 w-4" />
                    </a>
                    <a href={documentsService.fileUrl(f, true)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Download ${f.original_name}`}>
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">No files uploaded for this document.</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
