"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { ArrowLeft, Calculator, Camera, ChevronRight, ClipboardList, Eye, Fuel, History, ImagePlus, MoreVertical, Pencil, ReceiptText, Save, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dropdown } from "@/components/ui/dropdown";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { BODY_TYPES, FUEL_TYPES, PAYMENT_METHODS, VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatNumber, fromDateTimeLocal, toDateTimeLocal } from "@/lib/utils";
import { api } from "@/services/api-client";
import { fuelService } from "@/services/resources";
import type { FuelRecord, Paginated, Vehicle } from "@/types/api";
import { applyApiErrors, nullable } from "../shared";
import { useFleetOptions } from "./use-fleet-options";

export const FUEL_PATH = "/fleet/fuel";
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const NOTES_LIMIT = 255;
const MAX_AMOUNT = 10_000;
const OTHER_STATION = "__other__";

const round2 = (n: number) => Math.round(n * 100) / 100;
const amount = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((v) => Number.isFinite(Number(v)), "Enter a number.")
    .refine((v) => Number(v) > 0, "Must be more than 0.")
    .refine((v) => Number(v) <= MAX_AMOUNT, `Up to ${formatNumber(MAX_AMOUNT)}.`);

const schema = z.object({
  fueled_at: z
    .string()
    .min(1, "Date and time are required.")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Enter a valid date and time.")
    .refine((v) => new Date(v) <= new Date(), "Can't be in the future."),
  fuel_type: z.string().min(1, "Select a fuel type."),
  vehicle_id: z.string().min(1, "Select a vehicle."),
  driver_id: z.string().min(1, "Select a driver."),
  liters: amount("Volume"),
  price_per_liter: amount("Unit price"),
  station: z.string().trim().min(1, "Select or enter a fuel station.").max(255),
  odometer_km: z
    .string()
    .trim()
    .min(1, "Odometer reading is required.")
    .refine((v) => /^\d+$/.test(v), "Whole kilometers only.")
    .refine((v) => Number(v) <= 10_000_000, "That reading is too large."),
  payment_method: z.string().min(1, "Select a payment method."),
  receipt_number: z.string().trim().min(1, "Receipt number is required.").max(60),
  reference_number: z.string().trim().max(60),
  notes: z.string().max(NOTES_LIMIT, `Up to ${NOTES_LIMIT} characters.`),
});
type FormValues = z.infer<typeof schema>;
const FIELDS = [...Object.keys(schema.shape), "total_cost"];

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
function defaults(r?: FuelRecord | null, vehicleId?: string): FormValues {
  return {
    fueled_at: toDateTimeLocal(r?.fueled_at ?? new Date()),
    fuel_type: r?.fuel_type ?? "diesel",
    vehicle_id: r ? String(r.vehicle_id) : (vehicleId ?? ""),
    driver_id: str(r?.driver_id),
    liters: str(r?.liters),
    price_per_liter: str(r?.price_per_liter),
    station: str(r?.station),
    odometer_km: str(r?.odometer_km),
    payment_method: r?.payment_method ?? "",
    receipt_number: str(r?.receipt_number),
    reference_number: str(r?.reference_number),
    notes: str(r?.notes),
  };
}

const vehicleLabel = (v: Vehicle) => `${v.plate_number} - ${v.make} ${v.model} (${labelOf(BODY_TYPES, v.body_type ?? "") || labelOf(VEHICLE_TYPES, v.vehicle_type)})`;

/** `/fleet/fuel/create` and `/fleet/fuel/[id]/edit` (same layout family as Add Vehicle / Add Driver). */
export function FuelEditor({ recordId, defaultVehicleId }: { recordId?: number; defaultVehicleId?: string }) {
  const { canOperate } = usePermissions();
  const existing = useQuery({
    queryKey: ["fuel", recordId, "form"],
    queryFn: () => fuelService.get(recordId!).then((r) => r.data),
    enabled: !!recordId,
  });

  if (!canOperate) return <ErrorState message="You do not have permission to add or edit fuel transactions." />;
  if (recordId) {
    if (existing.isLoading) return <LoadingState label="Loading fuel transaction…" />;
    if (existing.error || !existing.data) return <ErrorState message={existing.error?.message ?? "Fuel transaction not found."} onRetry={() => existing.refetch()} />;
    return <FuelForm key={existing.data.id} record={existing.data} />;
  }
  return <FuelForm defaultVehicleId={defaultVehicleId} />;
}

function FuelForm({ record, defaultVehicleId }: { record?: FuelRecord; defaultVehicleId?: string }) {
  const router = useRouter();
  const notify = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = !!record;

  const { vehicles, drivers } = useFleetOptions();
  const stationsQuery = useQuery({ queryKey: ["fuel", "stations"], queryFn: () => fuelService.stations().then((r) => r.data), staleTime: 60_000 });
  const stations = stationsQuery.data ?? [];

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(record, defaultVehicleId) });
  const values = watch();
  const vehicle = vehicles.find((v) => String(v.id) === values.vehicle_id);
  const driver = drivers.find((d) => String(d.id) === values.driver_id);

  // Default fuel type and driver to the selected vehicle's (new transactions only).
  useEffect(() => {
    if (record || !vehicle) return;
    setValue("fuel_type", vehicle.fuel_type);
    if (vehicle.assigned_driver_id) setValue("driver_id", String(vehicle.assigned_driver_id));
  }, [vehicle, record, setValue]);

  // ----- Total: volume × unit price, or work out the unit price from a receipt total ----
  const liters = Number(values.liters);
  const price = Number(values.price_per_liter);
  const computed = liters > 0 && price > 0 ? round2(liters * price) : null;
  const [totalInput, setTotalInput] = useState<string | null>(null);
  const totalShown = totalInput ?? (computed === null ? "" : computed.toFixed(2));
  const totalMismatch = totalInput !== null && totalInput !== "" && computed !== null && Math.abs(Number(totalInput) - computed) > 0.01;

  const recalculate = () => {
    const total = Number(totalInput);
    if (totalInput && total > 0 && liters > 0) {
      setValue("price_per_liter", round2(total / liters).toFixed(2), { shouldValidate: true });
    }
    setTotalInput(null);
    clearErrors("total_cost" as keyof FormValues);
  };

  // ----- Station: pick a previous one or type a new one ---------------------------------
  const [stationMode, setStationMode] = useState<"list" | "other" | null>(null);
  const customStation = (stationMode ?? (values.station && !stations.includes(values.station) ? "other" : stations.length || stationsQuery.isLoading ? "list" : "other")) === "other";

  // ----- Receipt photo: uploaded right away when editing, after saving a new one -------
  const [receiptUrl, setReceiptUrl] = useState<string | null>(record?.receipt ? `${api.url(record.receipt)}?v=${Date.now()}` : null);
  const [pendingReceipt, setPendingReceipt] = useState<File | null>(null);
  useEffect(
    () => () => {
      if (receiptUrl?.startsWith("blob:")) URL.revokeObjectURL(receiptUrl);
    },
    [receiptUrl],
  );

  const pickReceipt = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) return notify("Receipt photos must be JPG or PNG.", "error");
    if (file.size > MAX_RECEIPT_BYTES) return notify("Receipt photos can be up to 5 MB.", "error");
    if (record) {
      try {
        const result = await fuelService.uploadReceipt(record.id, file);
        setReceiptUrl(`${api.url(result.data.receipt)}?v=${Date.now()}`);
        notify(result.message);
        queryClient.invalidateQueries({ queryKey: ["fuel"] });
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not upload the receipt photo.", "error");
      }
    } else {
      setPendingReceipt(file);
      setReceiptUrl(URL.createObjectURL(file));
    }
  };

  const removeReceipt = async () => {
    if (record?.receipt && !pendingReceipt) {
      try {
        await fuelService.removeReceipt(record.id);
        queryClient.invalidateQueries({ queryKey: ["fuel"] });
      } catch (error) {
        return notify(error instanceof Error ? error.message : "Could not remove the receipt photo.", "error");
      }
    }
    setPendingReceipt(null);
    setReceiptUrl(null);
  };

  // ----- Save ----------------------------------------------------------------------------
  const mutation = useApiMutation(
    (v: FormValues) => {
      const payload = nullable({
        ...v,
        vehicle_id: Number(v.vehicle_id),
        driver_id: Number(v.driver_id),
        liters: Number(v.liters),
        price_per_liter: Number(v.price_per_liter),
        odometer_km: Number(v.odometer_km),
        fueled_at: fromDateTimeLocal(v.fueled_at),
      });
      return record ? fuelService.update(record.id, payload) : fuelService.create(payload);
    },
    { invalidate: [["fuel"], ["vehicle"], ["vehicles"], ["dashboard"]] },
  );

  const submit = handleSubmit(
    async (v) => {
      setFormError(null);
      if (totalMismatch) {
        setError("total_cost" as keyof FormValues, { message: "Doesn't match volume × unit price. Use the calculator to update the unit price." });
        return setFormError("Some details are missing or invalid. Check the highlighted fields.");
      }
      setSaving(true);
      try {
        const result = await mutation.mutateAsync(v);
        if (pendingReceipt) {
          try {
            await fuelService.uploadReceipt(result.data.id, pendingReceipt);
          } catch {
            notify("The transaction was saved, but the receipt photo could not be uploaded. Add it again from Edit Fuel Transaction.", "error");
          }
        }
        router.push(FUEL_PATH);
      } catch (error) {
        setFormError(applyApiErrors(error, setError as UseFormSetError<FormValues>, FIELDS));
      } finally {
        setSaving(false);
      }
    },
    () => setFormError("Some details are missing or invalid. Check the highlighted fields."),
  );

  // The vehicle's odometer, or its latest fuel reading when that is higher (excluding this transaction).
  const recent = useQuery({
    queryKey: ["fuel", "recent", vehicle?.id],
    queryFn: () => fuelService.list({ vehicle_id: vehicle!.id, per_page: 5, sort: "-fueled_at" }),
    enabled: !!vehicle,
  });
  const readings = [vehicle?.odometer_km, ...(recent.data?.data ?? []).filter((r) => r.id !== record?.id).map((r) => r.odometer_km)].filter((n): n is number => !!n);
  const lastOdometer = readings.length ? Math.max(...readings) : null;
  const odometerHint =
    lastOdometer !== null && values.odometer_km && Number(values.odometer_km) < lastOdometer
      ? `Lower than the vehicle's last reading (${formatNumber(lastOdometer)} km).`
      : lastOdometer !== null
        ? `Last reading: ${formatNumber(lastOdometer)} km`
        : undefined;
  const totalError = (errors as Record<string, { message?: string } | undefined>).total_cost?.message;
  const title = editing ? "Edit Fuel Transaction" : "Add Fuel Transaction";

  return (
    <form onSubmit={submit} noValidate>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">{editing ? "Update the details of this fuel transaction." : "Record a new fuel transaction for your vehicle."}</p>
        </div>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-ink-500">
          <span>Fleet &amp; Drivers</span>
          <ChevronRight className="h-4 w-4" />
          <Link href={FUEL_PATH} className="hover:text-ink-900">
            Fuel Management
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-ink-900">{title}</span>
        </nav>
      </div>

      {formError && (
        <div className="mb-5">
          <FormError message={formError} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Transaction information */}
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title="Transaction Information" icon={<Fuel />} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {/* Two stacks, as in the reference layout; on phones the left stack comes first. */}
            <div className="space-y-4">
              <Field label="Date & Time" htmlFor="fueled_at" error={errors.fueled_at?.message} required>
                <Input id="fueled_at" type="datetime-local" max={toDateTimeLocal(new Date())} invalid={!!errors.fueled_at} {...register("fueled_at")} />
              </Field>
              <Field label="Vehicle" htmlFor="vehicle_id" error={errors.vehicle_id?.message} required>
                {/* Remounts once the options load so the saved vehicle is selected. */}
                <Select
                  key={vehicles.length ? "loaded" : "loading"}
                  id="vehicle_id"
                  options={vehicles.map((v) => ({ value: String(v.id), label: vehicleLabel(v) }))}
                  placeholder="Select vehicle"
                  invalid={!!errors.vehicle_id}
                  {...register("vehicle_id")}
                />
              </Field>
              <Field label="Driver" htmlFor="driver_id" error={errors.driver_id?.message} required>
                <div className="relative">
                  {driver && (
                    <Avatar
                      name={driver.full_name}
                      src={driver.photo ? api.url(driver.photo) : null}
                      size="sm"
                      className="pointer-events-none absolute top-1/2 left-2 h-6 w-6 -translate-y-1/2 text-[10px]"
                    />
                  )}
                  <Select
                    key={drivers.length ? "loaded" : "loading"}
                    id="driver_id"
                    className={driver ? "pl-10" : undefined}
                    options={drivers.map((d) => ({ value: String(d.id), label: d.full_name }))}
                    placeholder="Select driver"
                    invalid={!!errors.driver_id}
                    {...register("driver_id")}
                  />
                </div>
              </Field>
              <Field label="Fuel Station" htmlFor="station" error={errors.station?.message} required>
                {customStation ? (
                  <div className="space-y-1">
                    <Input id="station" placeholder="e.g. Petron SLEX Southbound" invalid={!!errors.station} {...register("station")} />
                    {stations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setStationMode("list");
                          setValue("station", "");
                        }}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        Choose a previous station
                      </button>
                    )}
                  </div>
                ) : (
                  <Select
                    id="station"
                    value={values.station}
                    onChange={(e) => {
                      if (e.target.value === OTHER_STATION) {
                        setStationMode("other");
                        setValue("station", "");
                      } else {
                        setStationMode("list");
                        setValue("station", e.target.value, { shouldValidate: !!errors.station });
                      }
                    }}
                    options={[...stations.map((s) => ({ value: s, label: s })), { value: OTHER_STATION, label: "Other station…" }]}
                    placeholder={stationsQuery.isLoading ? "Loading stations…" : "Select fuel station"}
                    invalid={!!errors.station}
                  />
                )}
              </Field>
              <Field label="Odometer Reading (km)" htmlFor="odometer_km" error={errors.odometer_km?.message} hint={odometerHint} required>
                <Input id="odometer_km" type="number" inputMode="numeric" step="1" min={0} placeholder="0" invalid={!!errors.odometer_km} {...register("odometer_km")} />
              </Field>
              <Field label="Payment Method" htmlFor="payment_method" error={errors.payment_method?.message} required>
                <Select id="payment_method" options={PAYMENT_METHODS} placeholder="Select payment method" invalid={!!errors.payment_method} {...register("payment_method")} />
              </Field>
            </div>
            <div className="space-y-4">
              <Field label="Fuel Type" htmlFor="fuel_type" error={errors.fuel_type?.message} required>
                <Select id="fuel_type" options={FUEL_TYPES} invalid={!!errors.fuel_type} {...register("fuel_type")} />
              </Field>
              <Field label="Volume (Liters)" htmlFor="liters" error={errors.liters?.message} required>
                <Input id="liters" type="number" inputMode="decimal" step="0.01" min={0} placeholder="0.00" invalid={!!errors.liters} {...register("liters")} />
              </Field>
              <Field label="Unit Price (₱/L)" htmlFor="price_per_liter" error={errors.price_per_liter?.message} required>
                <Input id="price_per_liter" type="number" inputMode="decimal" step="0.01" min={0} placeholder="0.00" invalid={!!errors.price_per_liter} {...register("price_per_liter")} />
              </Field>
              <Field
                label="Total Amount (₱)"
                htmlFor="total_cost"
                error={totalError}
                hint={totalMismatch ? "Click the calculator to work out the unit price from this total." : "Volume × unit price, calculated automatically."}
                required
              >
                <div className="flex">
                  <Input
                    id="total_cost"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={totalShown}
                    onChange={(e) => setTotalInput(e.target.value)}
                    invalid={!!totalError}
                    className="rounded-r-none bg-ink-50"
                  />
                  <button
                    type="button"
                    onClick={recalculate}
                    title={totalMismatch ? "Work out the unit price from this total" : "Recalculate total"}
                    aria-label={totalMismatch ? "Work out the unit price from this total" : "Recalculate total"}
                    className="flex w-11 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-ink-200 bg-ink-50 text-ink-700 hover:bg-ink-100"
                  >
                    <Calculator className="h-4 w-4" />
                  </button>
                </div>
              </Field>
              <Field label="Receipt No." htmlFor="receipt_number" error={errors.receipt_number?.message} required>
                <Input id="receipt_number" placeholder="e.g. OR-100234" invalid={!!errors.receipt_number} {...register("receipt_number")} />
              </Field>
              <Field label="Reference No." htmlFor="reference_number" error={errors.reference_number?.message}>
                <Input id="reference_number" placeholder="e.g. PO No. / Trip No. / Ref No." invalid={!!errors.reference_number} {...register("reference_number")} />
              </Field>
              <Field label="Remarks" htmlFor="notes" error={errors.notes?.message}>
                <Textarea id="notes" rows={3} maxLength={NOTES_LIMIT} placeholder="Anything worth noting about this fill-up" invalid={!!errors.notes} {...register("notes")} />
                <p className="mt-1 text-right text-xs text-ink-500">
                  {values.notes.length}/{NOTES_LIMIT}
                </p>
              </Field>
            </div>
          </CardBody>
        </Card>

        {/* Receipt photo */}
        <Card className="flex flex-col">
          <CardHeader
            title="Receipt Photo"
            icon={<ReceiptText />}
            action={
              <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                <Camera className="h-4 w-4" /> {receiptUrl ? "Change Photo" : "Upload Photo"}
              </Button>
            }
          />
          <CardBody className="flex flex-1 flex-col">
            <div className="relative flex min-h-72 flex-1 items-center justify-center overflow-hidden rounded-lg border border-ink-100 bg-ink-50">
              {receiptUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- served by the API / local preview */}
                  <img src={receiptUrl} alt="Fuel receipt" className="absolute inset-0 h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={removeReceipt}
                    className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-sm text-ink-700 shadow hover:text-brand-700"
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => fileInput.current?.click()} className="flex flex-col items-center gap-2 p-6 text-center text-ink-500 hover:text-brand-600">
                  <ImagePlus className="h-10 w-10" />
                  <span className="text-sm font-medium">Add a photo of the receipt</span>
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => {
                pickReceipt(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="mt-2 text-xs text-ink-500">
              JPG or PNG, up to 5 MB.
              {!editing && pendingReceipt && " It uploads when you save."}
            </p>
          </CardBody>
        </Card>

        {/* Live summary */}
        <Card>
          <CardHeader title="Transaction Summary" icon={<ClipboardList />} />
          <CardBody className="space-y-3">
            <SummaryEntity label="Vehicle">
              <div className="flex items-center gap-3">
                {vehicle?.cover_photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served by the API
                  <img src={api.url(vehicle.cover_photo)} alt={vehicle.plate_number} className="h-12 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                    <Truck className="h-6 w-6" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900">{vehicle?.plate_number ?? "—"}</p>
                  {vehicle && <p className="text-xs text-ink-500">{vehicleLabel(vehicle).split(" - ")[1]}</p>}
                </div>
              </div>
            </SummaryEntity>
            <SummaryEntity label="Driver">
              <div className="flex items-center gap-2">
                {driver && <Avatar name={driver.full_name} src={driver.photo ? api.url(driver.photo) : null} size="sm" />}
                <span className="truncate text-sm text-ink-900">{driver?.full_name ?? "—"}</span>
              </div>
            </SummaryEntity>
            <SummaryEntity label="Fuel Station">
              <div className="flex items-center gap-2">
                {values.station && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                    <Fuel className="h-4 w-4" />
                  </span>
                )}
                <span className="truncate text-sm text-ink-900">{values.station || "—"}</span>
              </div>
            </SummaryEntity>

            <dl className="space-y-2 border-t border-ink-100 pt-4 text-sm">
              <SummaryRow label="Fuel Type">{values.fuel_type ? labelOf(FUEL_TYPES, values.fuel_type) : "-"}</SummaryRow>
              <SummaryRow label="Volume">{liters > 0 ? `${formatNumber(liters, 2)} L` : "-"}</SummaryRow>
              <SummaryRow label="Unit Price">{price > 0 ? formatCurrency(price) : "-"}</SummaryRow>
              <SummaryRow label="Total Amount">{computed !== null ? <span className="font-semibold">{formatCurrency(computed)}</span> : "-"}</SummaryRow>
              <SummaryRow label="Odometer">{values.odometer_km ? `${formatNumber(Number(values.odometer_km))} km` : "-"}</SummaryRow>
              <SummaryRow label="Date & Time">{values.fueled_at ? formatDateTime(new Date(values.fueled_at)) : "-"}</SummaryRow>
              <SummaryRow label="Payment Method">{values.payment_method ? labelOf(PAYMENT_METHODS, values.payment_method) : "-"}</SummaryRow>
              <SummaryRow label="Receipt No.">{values.receipt_number || "-"}</SummaryRow>
              <SummaryRow label="Reference No.">{values.reference_number || "-"}</SummaryRow>
              <SummaryRow label="Remarks">{values.notes || "-"}</SummaryRow>
            </dl>
          </CardBody>
        </Card>
      </div>

      <RecentTransactions vehicle={vehicle} query={recent} />

      {/* Actions */}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" onClick={() => router.push(FUEL_PATH)} className="min-w-32">
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
        <Button type="submit" size="lg" loading={saving} className="min-w-48">
          <Save className="h-4 w-4" /> {editing ? "Save Changes" : "Save Transaction"}
        </Button>
      </div>
    </form>
  );
}

function SummaryEntity({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-sm text-ink-500">{label}</span>
      {children}
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.75rem_0.75rem_minmax(0,1fr)] items-start">
      <dt className="whitespace-nowrap text-ink-500">{label}</dt>
      <span className="text-ink-500">:</span>
      <dd className="min-w-0 break-words text-ink-900">{children}</dd>
    </div>
  );
}

/** The selected vehicle's latest fuel transactions. */
function RecentTransactions({ vehicle, query: recent }: { vehicle?: Vehicle; query: UseQueryResult<Paginated<FuelRecord>> }) {
  const router = useRouter();
  const rows = recent.data?.data;

  return (
    <Card className="mt-5">
      <CardHeader
        title={`Recent Transactions${vehicle ? ` (${vehicle.plate_number})` : ""}`}
        icon={<History />}
        action={
          vehicle && (
            <Link href={`${FUEL_PATH}?vehicle=${vehicle.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          )
        }
      />
      {vehicle ? (
        <DataTable
          rows={rows}
          loading={recent.isFetching}
          error={recent.error}
          onRetry={() => recent.refetch()}
          rowKey={(r) => r.id}
          empty={{ title: "No fuel transactions yet", description: `Fuel purchases for ${vehicle.plate_number} will appear here.` }}
          columns={[
            { key: "n", header: "#", className: "text-ink-500 tabular-nums", cell: (r) => (rows?.indexOf(r) ?? 0) + 1 },
            { key: "date", header: "Date & Time", cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.fueled_at)}</span> },
            { key: "station", header: "Fuel Station", cell: (r) => r.station ?? "—" },
            { key: "type", header: "Fuel Type", cell: (r) => labelOf(FUEL_TYPES, r.fuel_type) },
            { key: "liters", header: "Volume (L)", className: "text-right tabular-nums", headerClassName: "text-right", cell: (r) => formatNumber(r.liters, 2) },
            { key: "price", header: "Unit Price (₱)", className: "text-right tabular-nums", headerClassName: "text-right", cell: (r) => formatNumber(r.price_per_liter, 2) },
            { key: "total", header: "Amount (₱)", className: "text-right font-medium tabular-nums text-ink-900", headerClassName: "text-right", cell: (r) => formatNumber(r.total_cost, 2) },
            { key: "odo", header: "Odometer (km)", className: "text-right tabular-nums", headerClassName: "text-right", cell: (r) => (r.odometer_km ? formatNumber(r.odometer_km) : "—") },
            { key: "driver", header: "Driver", cell: (r) => <span className="whitespace-nowrap">{r.driver?.full_name ?? "—"}</span> },
            { key: "receipt", header: "Receipt No.", cell: (r) => r.receipt_number ?? "—" },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              cell: (r) => (
                <Dropdown
                  trigger={({ toggle }) => (
                    <button type="button" onClick={toggle} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Transaction actions">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  )}
                  items={[
                    { label: "Edit transaction", icon: <Pencil />, onSelect: () => router.push(`${FUEL_PATH}/${r.id}/edit`) },
                    ...(r.receipt ? [{ label: "View receipt", icon: <Eye />, onSelect: () => window.open(api.url(r.receipt!), "_blank", "noopener") }] : []),
                  ]}
                />
              ),
            },
          ]}
        />
      ) : (
        <p className="px-5 py-8 text-center text-sm text-ink-500">Select a vehicle to see its recent fuel transactions.</p>
      )}
    </Card>
  );
}
