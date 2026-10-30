"use client";

import { useQuery } from "@tanstack/react-query";
import { differenceInYears } from "date-fns";
import { Activity, FileText, Fuel, IdCard, Pencil, PhoneCall, Route, Truck, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { BackLink, DetailPageState } from "@/components/ui/detail-page";
import { usePermissions } from "@/hooks/use-current-user";
import { DRIVER_DOCUMENT_TYPES, DRIVER_STATUS, EXPIRY_STATUS, FUEL_TYPES, LICENSE_TYPES, TRIP_STATUS, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { api } from "@/services/api-client";
import { driversService } from "@/services/resources";
import { DOCUMENTS_PATH } from "../documents/document-editor";
import { FUEL_PATH } from "../fuel/fuel-editor";
import { DetailRow } from "../orders/order-detail";
import { AssignedVehicleCard, PerformanceTiles } from "./driver-panel";
import { DRIVERS_PATH } from "./drivers-view";

/** `/fleet/drivers/[id]`: the full driver profile (the list's side panel is the quick view). */
export function DriverDetail({ id }: { id: number }) {
  const { canManageFleet } = usePermissions();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["driver", id], queryFn: () => driversService.detail(id) });
  const d = data?.data;

  if (isLoading || error || !d)
    return <DetailPageState loading={isLoading} error={error} onRetry={() => refetch()} backHref={DRIVERS_PATH} backLabel="Back to drivers" noun="driver" />;

  const trips = d.recent_trips ?? [];
  const fuel = d.recent_fuel_records ?? [];
  const documents = d.documents ?? [];

  return (
    <>
      <BackLink href={DRIVERS_PATH}>Back to drivers</BackLink>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={d.full_name} src={d.photo ? `${api.url(d.photo)}?v=${d.updated_at}` : null} size="lg" className="h-16 w-16 shrink-0 rounded-2xl text-2xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{d.full_name}</h1>
              <StatusBadge status={d.status} map={DRIVER_STATUS} dot={false} />
            </div>
            <p className="text-ink-500">
              {d.employee_code} · {labelOf(LICENSE_TYPES, d.license_type)} license
            </p>
          </div>
        </div>
        {canManageFleet && (
          <Button variant="secondary" onClick={() => router.push(`${DRIVERS_PATH}/${d.id}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit driver
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Personal Information" icon={<User />} />
          <CardBody>
            <dl>
              <DetailRow label="Contact No.">{d.phone || "—"}</DetailRow>
              <DetailRow label="Email">{d.email ?? "—"}</DetailRow>
              <DetailRow label="Address">{d.address ?? "—"}</DetailRow>
              <DetailRow label="Date of birth">{d.date_of_birth ? `${formatDate(d.date_of_birth)} (${differenceInYears(new Date(), new Date(d.date_of_birth))} yrs)` : "—"}</DetailRow>
              <DetailRow label="Date hired">{formatDate(d.date_hired)}</DetailRow>
              {d.notes && <DetailRow label="Notes">{d.notes}</DetailRow>}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="License Information" icon={<IdCard />} />
          <CardBody>
            <dl>
              <DetailRow label="License No.">{d.license_number}</DetailRow>
              <DetailRow label="License type">{labelOf(LICENSE_TYPES, d.license_type)}</DetailRow>
              <DetailRow label="Expiry date">
                <span className={d.license_expired ? "font-medium text-brand-700" : undefined}>
                  {formatDate(d.license_expiry)}
                  {d.license_expired && " (expired)"}
                </span>
              </DetailRow>
              <DetailRow label="Restrictions">{d.license_restrictions ?? "—"}</DetailRow>
            </dl>
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Assigned Vehicle" icon={<Truck />} />
            <CardBody>
              <AssignedVehicleCard vehicle={d.assigned_vehicle} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Emergency Contact" icon={<PhoneCall />} />
            <CardBody>
              <dl>
                <DetailRow label="Name">{d.emergency_contact_name ?? "—"}</DetailRow>
                <DetailRow label="Contact No.">{d.emergency_contact_phone ?? "—"}</DetailRow>
                <DetailRow label="Relationship">{d.emergency_contact_relation ?? "—"}</DetailRow>
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Performance (Last 30 Days)" icon={<Activity />} />
        <CardBody>
          <PerformanceTiles performance={data?.performance} />
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader title="Recent Trips" icon={<Route />} description={d.trips_count ? `Latest ${trips.length} of ${d.trips_count}` : undefined} />
          <DataTable
            rows={trips}
            rowKey={(t) => t.id}
            empty={{ title: "No trips yet" }}
            columns={[
              { key: "no", header: "Trip No.", cell: (t) => <Link href={`/transportation/itinerary/${t.id}`} className="font-medium whitespace-nowrap hover:text-brand-600">{t.trip_number}</Link> },
              { key: "route", header: "Route", cell: (t) => `${t.origin} → ${t.destination}` },
              { key: "vehicle", header: "Vehicle", cell: (t) => <span className="whitespace-nowrap">{t.vehicle?.plate_number ?? "—"}</span> },
              { key: "dep", header: "Departure", cell: (t) => <span className="whitespace-nowrap">{formatDateTime(t.departure_at)}</span> },
              { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} dot={false} /> },
            ]}
          />
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Recent Fuel Entries" icon={<Fuel />} description={d.fuel_records_count ? `Latest ${fuel.length} of ${d.fuel_records_count}` : undefined} />
          <DataTable
            rows={fuel}
            rowKey={(f) => f.id}
            onRowClick={(f) => router.push(`${FUEL_PATH}/${f.id}`)}
            empty={{ title: "No fuel records" }}
            columns={[
              { key: "date", header: "Date", cell: (f) => <span className="whitespace-nowrap">{formatDateTime(f.fueled_at)}</span> },
              { key: "vehicle", header: "Vehicle", cell: (f) => <span className="whitespace-nowrap">{f.vehicle?.plate_number ?? "—"}</span> },
              { key: "type", header: "Fuel", cell: (f) => labelOf(FUEL_TYPES, f.fuel_type) },
              { key: "liters", header: "Liters", className: "text-right tabular-nums", headerClassName: "text-right", cell: (f) => formatNumber(f.liters, 2) },
              { key: "cost", header: "Total", className: "text-right tabular-nums", headerClassName: "text-right", cell: (f) => formatCurrency(f.total_cost) },
            ]}
          />
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Documents"
          icon={<FileText />}
          action={
            <Link href={`${DOCUMENTS_PATH}?owner=driver&id=${d.id}`} className="text-sm font-medium text-brand-600 hover:underline">
              Open in Documents
            </Link>
          }
        />
        <DataTable
          rows={documents}
          rowKey={(doc) => doc.id}
          onRowClick={(doc) => router.push(`${DOCUMENTS_PATH}/driver/${doc.id}`)}
          empty={{ title: "No documents on file" }}
          columns={[
            {
              key: "title",
              header: "Document",
              cell: (doc) => (
                <span>
                  <span className="block font-medium text-ink-900">{doc.title}</span>
                  <span className="text-xs text-ink-500">{doc.document_number ?? "No number"}</span>
                </span>
              ),
            },
            { key: "type", header: "Type", cell: (doc) => labelOf(DRIVER_DOCUMENT_TYPES, doc.document_type) },
            { key: "expires", header: "Expires", cell: (doc) => <span className="whitespace-nowrap">{formatDate(doc.expires_at)}</span> },
            { key: "status", header: "Expiry Status", cell: (doc) => <StatusBadge status={doc.expiry_status} map={EXPIRY_STATUS} /> },
            { key: "files", header: "Files", className: "tabular-nums", cell: (doc) => doc.files?.length ?? 0 },
          ]}
        />
      </Card>
    </>
  );
}
