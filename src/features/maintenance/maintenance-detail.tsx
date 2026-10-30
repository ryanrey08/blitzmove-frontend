"use client";

import { useQuery } from "@tanstack/react-query";
import { Banknote, ClipboardList, History as HistoryIcon, Paperclip, Pencil, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BackLink, DetailPageState } from "@/components/ui/detail-page";
import { usePermissions } from "@/hooks/use-current-user";
import { MAINTENANCE_STATUS, MAINTENANCE_TYPES, labelOf } from "@/lib/constants";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { maintenanceService } from "@/services/resources";
import { DetailRow } from "../orders/order-detail";
import { MAINTENANCE_PATH } from "./maintenance-editor";
import { Costs, Details, Documents, History, VehicleSummary } from "./maintenance-panel";

/** `/fleet/maintenance/[id]`: one maintenance record on its own page (the list's side panel is the quick view). */
export function MaintenanceDetail({ id }: { id: number }) {
  const { canOperate } = usePermissions();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["maintenance", id], queryFn: () => maintenanceService.get(id).then((r) => r.data) });
  const r = data;

  if (isLoading || error || !r)
    return <DetailPageState loading={isLoading} error={error} onRetry={() => refetch()} backHref={MAINTENANCE_PATH} backLabel="Back to maintenance" noun="maintenance record" />;

  return (
    <>
      <BackLink href={MAINTENANCE_PATH}>Back to maintenance</BackLink>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ink-100 text-ink-700">
            <ClipboardList className="h-8 w-8" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{labelOf(MAINTENANCE_TYPES, r.service_type)}</h1>
              <StatusBadge status={r.display_status} map={MAINTENANCE_STATUS} />
            </div>
            <p className="text-ink-500">
              {r.reference_number}
              {r.vehicle ? ` · ${r.vehicle.plate_number}` : ""}
            </p>
          </div>
        </div>
        {canOperate && (
          <Button variant="secondary" onClick={() => router.push(`${MAINTENANCE_PATH}/${r.id}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit maintenance
          </Button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card className="min-w-0">
          <CardHeader title="Maintenance Details" icon={<ClipboardList />} />
          <CardBody>
            {/* Read-only here; the checklist is ticked off from the list's panel or the edit page. */}
            <Details record={r} canEdit={false} />
          </CardBody>
        </Card>
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Vehicle"
              icon={<Truck />}
              action={
                r.vehicle && (
                  <Link href={`/fleet/vehicles/${r.vehicle.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    View vehicle
                  </Link>
                )
              }
            />
            <CardBody>
              <VehicleSummary record={r} />
              <dl className="mt-4 border-t border-ink-100 pt-3">
                <DetailRow label="Assigned driver">
                  {r.vehicle?.assigned_driver ? (
                    <Link href={`/fleet/drivers/${r.vehicle.assigned_driver.id}`} className="text-brand-600 hover:underline">
                      {r.vehicle.assigned_driver.full_name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </DetailRow>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Service Record" icon={<HistoryIcon />} />
            <CardBody>
              <dl>
                <DetailRow label="Service date">{formatDate(r.service_date)}</DetailRow>
                <DetailRow label="Last service">{formatDate(r.last_service_date)}</DetailRow>
                <DetailRow label="Odometer">{r.odometer_km ? `${formatNumber(r.odometer_km)} km` : "—"}</DetailRow>
                <DetailRow label="Started">{formatDateTime(r.started_at)}</DetailRow>
                <DetailRow label="Completed">{formatDateTime(r.completed_at)}</DetailRow>
                <DetailRow label="Created">
                  {formatDateTime(r.created_at)}
                  {r.created_by ? ` by ${r.created_by}` : ""}
                </DetailRow>
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader title="Costs" icon={<Banknote />} />
          <CardBody>
            <Costs record={r} />
          </CardBody>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Attachments" icon={<Paperclip />} description={r.files?.length ? `${r.files.length} file${r.files.length === 1 ? "" : "s"}` : undefined} />
          <CardBody>
            <Documents record={r} />
          </CardBody>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Vehicle Maintenance History" icon={<HistoryIcon />} />
          <CardBody>
            <History record={r} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
