"use client";

import { useQuery } from "@tanstack/react-query";
import { Fuel, ImageOff, Pencil, Receipt, Truck, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BackLink, DetailPageState } from "@/components/ui/detail-page";
import { usePermissions } from "@/hooks/use-current-user";
import { FUEL_TYPES, PAYMENT_METHODS, labelOf } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";
import { api } from "@/services/api-client";
import { fuelService } from "@/services/resources";
import { AssignedVehicleCard, DriverLinkCard } from "../drivers/driver-panel";
import { DetailRow } from "../orders/order-detail";
import { FUEL_PATH } from "./fuel-editor";

/** `/fleet/fuel/[id]`: one fuel transaction with its vehicle, driver and receipt photo. */
export function FuelDetail({ id }: { id: number }) {
  const { canOperate } = usePermissions();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["fuel", "detail", id], queryFn: () => fuelService.get(id).then((r) => r.data) });
  const r = data;

  if (isLoading || error || !r)
    return <DetailPageState loading={isLoading} error={error} onRetry={() => refetch()} backHref={FUEL_PATH} backLabel="Back to fuel management" noun="fuel transaction" />;

  const receiptUrl = r.receipt ? api.url(r.receipt) : null;

  return (
    <>
      <BackLink href={FUEL_PATH}>Back to fuel management</BackLink>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Fuel className="h-8 w-8" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">
              {formatNumber(r.liters, 2)} L {labelOf(FUEL_TYPES, r.fuel_type)}
            </h1>
            <p className="text-ink-500">
              {formatDateTime(r.fueled_at)}
              {r.station ? ` · ${r.station}` : ""}
            </p>
          </div>
        </div>
        {canOperate && (
          <Button variant="secondary" onClick={() => router.push(`${FUEL_PATH}/${r.id}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit transaction
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Transaction Details" icon={<Fuel />} />
          <CardBody className="grid gap-x-8 xl:grid-cols-2">
            <dl>
              <DetailRow label="Date & time">{formatDateTime(r.fueled_at)}</DetailRow>
              <DetailRow label="Fuel type">{labelOf(FUEL_TYPES, r.fuel_type)}</DetailRow>
              <DetailRow label="Volume">{`${formatNumber(r.liters, 2)} L`}</DetailRow>
              <DetailRow label="Unit price">{`${formatCurrency(r.price_per_liter)} / L`}</DetailRow>
              <DetailRow label="Total amount">
                <span className="font-semibold">{formatCurrency(r.total_cost)}</span>
              </DetailRow>
              <DetailRow label="Payment method">{r.payment_method ? labelOf(PAYMENT_METHODS, r.payment_method) : "—"}</DetailRow>
            </dl>
            <dl>
              <DetailRow label="Fuel station">{r.station ?? "—"}</DetailRow>
              <DetailRow label="Odometer">{r.odometer_km ? `${formatNumber(r.odometer_km)} km` : "—"}</DetailRow>
              <DetailRow label="Receipt No.">{r.receipt_number ?? "—"}</DetailRow>
              <DetailRow label="Reference No.">{r.reference_number ?? "—"}</DetailRow>
              <DetailRow label="Trip">
                {r.trip ? (
                  <Link href={`/transportation/itinerary/${r.trip.id}`} className="text-brand-600 hover:underline">
                    {r.trip.trip_number}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="Recorded">{formatDateTime(r.created_at)}</DetailRow>
            </dl>
            {r.notes && (
              <dl className="xl:col-span-2">
                <DetailRow label="Notes">
                  <span className="whitespace-pre-line">{r.notes}</span>
                </DetailRow>
              </dl>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Receipt Photo"
            icon={<Receipt />}
            action={
              receiptUrl && (
                <a href={receiptUrl} target="_blank" rel="noopener" className="text-sm font-medium text-brand-600 hover:underline">
                  Open
                </a>
              )
            }
          />
          <CardBody>
            {receiptUrl ? (
              <a href={receiptUrl} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-ink-100">
                {/* eslint-disable-next-line @next/next/no-img-element -- served by the API */}
                <img src={receiptUrl} alt="Fuel receipt" className="max-h-96 w-full bg-ink-50 object-contain" />
              </a>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-lg bg-ink-50 py-10 text-sm text-ink-500">
                <ImageOff className="h-6 w-6 text-ink-400" />
                No receipt photo uploaded.
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Vehicle"
            icon={<Truck />}
            action={
              r.vehicle && (
                <Link href={`${FUEL_PATH}?vehicle=${r.vehicle.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                  Fuel history
                </Link>
              )
            }
          />
          <CardBody>
            <AssignedVehicleCard vehicle={r.vehicle} empty="Vehicle not found." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Driver" icon={<User />} />
          <CardBody>
            <DriverLinkCard driver={r.driver} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
