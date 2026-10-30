"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Banknote, ChevronRight, ClipboardCheck, ClipboardList, CloudUpload, Eye, FileText, Paperclip, Plus, Save, Trash2, Truck, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/use-current-user";
import {
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_CHECKLIST,
  MAINTENANCE_REMINDERS,
  MAINTENANCE_STATUS,
  MAINTENANCE_STORED_STATUSES,
  MAINTENANCE_TYPES,
  VEHICLE_STATUS,
  labelOf,
} from "@/lib/constants";
import { cn, formatCurrency, formatDate, formatFileSize, formatNumber } from "@/lib/utils";
import { api } from "@/services/api-client";
import { maintenanceService } from "@/services/resources";
import type { DocumentFile, MaintenanceCategory, MaintenanceDisplayStatus, MaintenanceRecord, MaintenanceType } from "@/types/api";
import { vehicleLabel } from "../fuel/fuel-editor";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { applyApiErrors, nullable } from "../shared";

export const MAINTENANCE_PATH = "/fleet/maintenance";
export const DESCRIPTION_LIMIT = 500;
const NOTES_LIMIT = 1000;
const MAX_COST = 10_000_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 20;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];

/** Category that usually goes with a service type (new records only; it can be changed). */
const DEFAULT_CATEGORY: Partial<Record<MaintenanceType, MaintenanceCategory>> = {
  preventive_maintenance: "preventive",
  oil_change: "preventive",
  tire_service: "preventive",
  inspection: "inspection",
  engine_repair: "corrective",
  brake_service: "corrective",
  transmission_service: "corrective",
  electrical: "corrective",
  aircon_service: "corrective",
  suspension: "corrective",
  body_repair: "corrective",
};

const today = () => format(new Date(), "yyyy-MM-dd");
const optionalAmount = z
  .string()
  .trim()
  .refine((v) => v === "" || Number.isFinite(Number(v)), "Enter a number.")
  .refine((v) => v === "" || Number(v) >= 0, "Can't be negative.")
  .refine((v) => v === "" || Number(v) <= MAX_COST, `Up to ${formatNumber(MAX_COST)}.`);

const schema = z
  .object({
    reference_number: z.string().trim().max(30, "Up to 30 characters."),
    vehicle_id: z.string().min(1, "Select a vehicle."),
    service_type: z.string().min(1, "Select a service type."),
    category: z.string().min(1, "Select a category."),
    status: z.string().min(1, "Select a status."),
    scheduled_date: z.string().min(1, "Schedule date is required."),
    service_date: z.string(),
    odometer_km: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d+$/.test(v), "Whole kilometers only.")
      .refine((v) => v === "" || Number(v) <= 10_000_000, "That reading is too large."),
    estimated_cost: optionalAmount,
    actual_cost: optionalAmount,
    service_provider: z.string().trim().max(255),
    assigned_to: z.string().trim().max(120),
    reminder_days: z.string(),
    description: z.string().max(DESCRIPTION_LIMIT, `Up to ${DESCRIPTION_LIMIT} characters.`),
    notes: z.string().max(NOTES_LIMIT, `Up to ${NOTES_LIMIT} characters.`),
  })
  .refine((v) => v.status !== "completed" || !!v.service_date, { path: ["service_date"], message: "Enter the date the work was done." })
  .refine((v) => !v.service_date || v.service_date <= today(), { path: ["service_date"], message: "Can't be in the future." });
type FormValues = z.infer<typeof schema>;
const FIELDS = [...Object.keys(schema.shape), "parts", "checklist"];

interface PartRow {
  key: number;
  name: string;
  quantity: string;
  unit_cost: string;
}
interface PendingFile {
  key: number;
  file: File;
  status: "ready" | "uploading" | "error";
  progress: number;
  error?: string;
}
let seq = 0;

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
function defaults(r?: MaintenanceRecord, vehicleId?: string): FormValues {
  return {
    reference_number: r?.reference_number ?? "",
    vehicle_id: r ? String(r.vehicle_id) : (vehicleId ?? ""),
    service_type: r?.service_type ?? "",
    category: r?.category ?? "",
    status: r?.status ?? "scheduled",
    scheduled_date: r?.scheduled_date ?? today(),
    service_date: str(r?.service_date),
    odometer_km: str(r?.odometer_km),
    estimated_cost: str(r?.estimated_cost),
    actual_cost: str(r?.actual_cost),
    service_provider: str(r?.service_provider),
    assigned_to: str(r?.assigned_to),
    reminder_days: r ? str(r.reminder_days) : "3",
    description: str(r?.description),
    notes: str(r?.notes),
  };
}

/** What the badge would show for these values (scheduled work turns due soon / overdue by date). */
function displayStatus(status: string, scheduled: string): MaintenanceDisplayStatus | null {
  if (status !== "scheduled") return (status as MaintenanceDisplayStatus) || null;
  if (!scheduled) return "scheduled";
  const days = (new Date(`${scheduled}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86_400_000;
  return days < 0 ? "overdue" : days <= 7 ? "due_soon" : "scheduled";
}

/** `/fleet/maintenance/create` and `/fleet/maintenance/[id]/edit` (same layout family as Add Fuel Transaction / Upload Document). */
export function MaintenanceEditor({ recordId, defaultVehicleId }: { recordId?: number; defaultVehicleId?: string }) {
  const { canOperate } = usePermissions();
  const existing = useQuery({
    queryKey: ["maintenance", recordId, "form"],
    queryFn: () => maintenanceService.get(recordId!).then((r) => r.data),
    enabled: !!recordId,
  });

  if (!canOperate) return <ErrorState message="You do not have permission to add or edit maintenance." />;
  if (recordId) {
    if (existing.isLoading) return <LoadingState label="Loading maintenance…" />;
    if (existing.error || !existing.data) return <ErrorState message={existing.error?.message ?? "Maintenance record not found."} onRetry={() => existing.refetch()} />;
    return <MaintenanceForm key={existing.data.id} record={existing.data} />;
  }
  return <MaintenanceForm defaultVehicleId={defaultVehicleId} />;
}

function MaintenanceForm({ record, defaultVehicleId }: { record?: MaintenanceRecord; defaultVehicleId?: string }) {
  const router = useRouter();
  const notify = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(record?.id ?? null);
  const editing = !!record;

  const { vehicles } = useFleetOptions();
  const pickLists = useQuery({ queryKey: ["maintenance", "options"], queryFn: () => maintenanceService.options().then((r) => r.data), staleTime: 60_000 });
  const nextNumber = useQuery({ queryKey: ["maintenance", "next-number"], queryFn: () => maintenanceService.nextNumber().then((r) => r.data.reference_number), enabled: !editing });

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(record, defaultVehicleId) });
  const values = watch();
  const vehicle = vehicles.find((v) => String(v.id) === values.vehicle_id);

  // Suggest the next reference number; the API assigns one if it is left blank.
  useEffect(() => {
    if (nextNumber.data && !getValues("reference_number")) setValue("reference_number", nextNumber.data);
  }, [nextNumber.data, getValues, setValue]);

  // A new record's category follows the service type until it is picked by hand.
  const categoryTouched = useRef(editing);
  const serviceType = values.service_type as MaintenanceType;
  useEffect(() => {
    const category = DEFAULT_CATEGORY[serviceType];
    if (!categoryTouched.current && category) setValue("category", category, { shouldValidate: !!errors.category });
  }, [serviceType, setValue, errors.category]);

  // Completing work defaults the service date to today.
  useEffect(() => {
    if (values.status === "completed" && !getValues("service_date")) setValue("service_date", today());
  }, [values.status, getValues, setValue]);

  // ----- Parts & checklist ---------------------------------------------------------------
  const [parts, setParts] = useState<PartRow[]>(() => (record?.parts ?? []).map((p) => ({ key: ++seq, name: p.name, quantity: String(p.quantity), unit_cost: String(p.unit_cost) })));
  const [partsError, setPartsError] = useState<string | null>(null);
  const patchPart = (key: number, patch: Partial<PartRow>) => setParts((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const partsTotal = parts.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_cost) || 0), 0);

  const [checklist, setChecklist] = useState(() => record?.checklist ?? MAINTENANCE_CHECKLIST.map((item) => ({ item, done: false })));
  const [newItem, setNewItem] = useState("");
  const addItem = () => {
    const item = newItem.trim();
    if (!item) return;
    if (checklist.some((c) => c.item.toLowerCase() === item.toLowerCase())) return notify("That item is already on the checklist.", "error");
    setChecklist((list) => [...list, { item: item.slice(0, 100), done: false }]);
    setNewItem("");
  };

  // ----- Attachments: uploaded one at a time after the details are saved ------------------
  const [stored, setStored] = useState<DocumentFile[]>(record?.files ?? []);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const addFiles = (list: FileList | File[]) => {
    const rejected: string[] = [];
    const accepted = Array.from(list).filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) rejected.push(`${f.name} is not a PDF, JPG or PNG.`);
      else if (f.size > MAX_FILE_BYTES) rejected.push(`${f.name} is larger than 10 MB.`);
      else return true;
      return false;
    });
    const room = MAX_FILES - stored.length - pending.length;
    if (accepted.length > room) rejected.push(`Up to ${MAX_FILES} files per record; ${accepted.length - Math.max(room, 0)} were not added.`);
    setPending((current) => [...current, ...accepted.slice(0, Math.max(room, 0)).map((file) => ({ key: ++seq, file, status: "ready" as const, progress: 0 }))]);
    if (rejected.length) notify(rejected.join(" "), "error");
  };
  const patchPending = (key: number, patch: Partial<PendingFile>) => setPending((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const removeStored = async (file: DocumentFile) => {
    try {
      const result = await maintenanceService.removeFile(file);
      setStored((list) => list.filter((f) => f.id !== file.id));
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      notify(result.message);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not remove the file.", "error");
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!saving && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  // ----- Save --------------------------------------------------------------------------------
  const submit = handleSubmit(
    async (v) => {
      setFormError(null);
      setPartsError(null);
      const filled = parts.filter((p) => p.name.trim() || p.quantity || p.unit_cost);
      if (filled.some((p) => !p.name.trim() || !(Number(p.quantity) > 0) || p.unit_cost === "" || !(Number(p.unit_cost) >= 0))) {
        setPartsError("Each part needs a name, a quantity above 0 and a unit cost.");
        return setFormError("Some details are missing or invalid. Check the highlighted fields.");
      }

      setSaving(true);
      let id = savedId;
      try {
        const payload = nullable({
          ...v,
          vehicle_id: Number(v.vehicle_id),
          odometer_km: v.odometer_km === "" ? "" : Number(v.odometer_km),
          estimated_cost: v.estimated_cost === "" ? "" : Number(v.estimated_cost),
          actual_cost: v.actual_cost === "" ? "" : Number(v.actual_cost),
          reminder_days: v.reminder_days === "" ? "" : Number(v.reminder_days),
          service_date: v.status === "completed" || v.service_date ? v.service_date : "",
          parts: filled.map((p) => ({ name: p.name.trim(), quantity: Number(p.quantity), unit_cost: Number(p.unit_cost) })),
          checklist,
        });
        const result = id ? await maintenanceService.update(id, payload) : await maintenanceService.create(payload);
        id = result.data.id;
        setSavedId(id);
      } catch (error) {
        setFormError(applyApiErrors(error, setError as UseFormSetError<FormValues>, FIELDS));
        setSaving(false);
        return;
      }

      let failed = 0;
      for (const p of pending) {
        patchPending(p.key, { status: "uploading", progress: 0, error: undefined });
        try {
          const result = await maintenanceService.addFile(id, p.file, (progress) => patchPending(p.key, { progress }));
          setStored((list) => [...list, result.data]);
          setPending((list) => list.filter((x) => x.key !== p.key));
        } catch (error) {
          failed++;
          patchPending(p.key, { status: "error", progress: 0, error: error instanceof Error ? error.message : "Upload failed." });
        }
      }

      ["maintenance", "vehicles", "vehicle"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      setSaving(false);
      if (failed) {
        return setFormError(
          `The maintenance details were saved, but ${failed} file${failed === 1 ? "" : "s"} did not upload. Retry or remove the files marked below, then click ${editing ? "Save Changes" : "Save Maintenance"} again.`,
        );
      }
      notify(editing ? "Maintenance updated." : "Maintenance saved.");
      router.push(`${MAINTENANCE_PATH}?record=${id}`);
    },
    () => setFormError("Some details are missing or invalid. Check the highlighted fields."),
  );

  // Last completed service of this type on the selected vehicle.
  const lastService = useQuery({
    queryKey: ["maintenance", "last", vehicle?.id, serviceType],
    queryFn: () => maintenanceService.list({ vehicle_id: vehicle!.id, service_type: serviceType, status: "completed", sort: "-service_date", per_page: 1 }).then((r) => r.data[0] ?? null),
    enabled: !!vehicle && !!serviceType,
  });
  const last = lastService.data && lastService.data.id !== record?.id ? lastService.data : null;

  const shownStatus = displayStatus(values.status, values.scheduled_date);
  const title = editing ? "Edit Maintenance" : "Add Maintenance";
  const serviceProviders = pickLists.data?.service_providers ?? [];
  const assignees = pickLists.data?.assignees ?? [];

  return (
    <form onSubmit={submit} noValidate>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">{editing ? "Update this maintenance record." : "Schedule or record a service for one of your vehicles."}</p>
        </div>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-ink-500">
          <span>Fleet &amp; Drivers</span>
          <ChevronRight className="h-4 w-4" />
          <Link href={MAINTENANCE_PATH} className="hover:text-ink-900">
            Maintenance
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* Maintenance information */}
          <Card>
            <CardHeader title="Maintenance Information" icon={<Wrench />} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Reference No." htmlFor="reference_number" error={errors.reference_number?.message} hint={editing ? undefined : "Suggested automatically; you can use your own job order number."}>
                <Input id="reference_number" placeholder={nextNumber.isLoading ? "Generating…" : "e.g. MNT-2026-0001"} invalid={!!errors.reference_number} {...register("reference_number")} />
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
              <Field label="Service Type" htmlFor="service_type" error={errors.service_type?.message} required>
                <Select id="service_type" options={MAINTENANCE_TYPES} placeholder="Select service type" invalid={!!errors.service_type} {...register("service_type")} />
              </Field>
              <Field label="Category" htmlFor="category" error={errors.category?.message} required>
                <Select
                  id="category"
                  options={MAINTENANCE_CATEGORIES}
                  placeholder="Select category"
                  invalid={!!errors.category}
                  {...register("category", { onChange: () => (categoryTouched.current = true) })}
                />
              </Field>
              <Field label="Schedule Date" htmlFor="scheduled_date" error={errors.scheduled_date?.message} hint="When the work is due (shown as Next Due)." required>
                <Input id="scheduled_date" type="date" invalid={!!errors.scheduled_date} {...register("scheduled_date")} />
              </Field>
              <Field label="Status" htmlFor="status" error={errors.status?.message} required>
                <div className="flex items-center gap-2">
                  <Select id="status" options={MAINTENANCE_STORED_STATUSES} invalid={!!errors.status} className="flex-1" {...register("status")} />
                  {shownStatus && shownStatus !== values.status && <StatusBadge status={shownStatus} map={MAINTENANCE_STATUS} dot={false} />}
                </div>
              </Field>
              <Field
                label="Service Date"
                htmlFor="service_date"
                error={errors.service_date?.message}
                hint={values.status === "completed" ? "The day the work was done." : "Fill in once the work is done."}
                required={values.status === "completed"}
              >
                <Input id="service_date" type="date" max={today()} invalid={!!errors.service_date} {...register("service_date")} />
              </Field>
              <Field
                label="Odometer Reading (km)"
                htmlFor="odometer_km"
                error={errors.odometer_km?.message}
                hint={vehicle?.odometer_km ? `Vehicle's last reading: ${formatNumber(vehicle.odometer_km)} km` : undefined}
              >
                <Input id="odometer_km" type="number" inputMode="numeric" step="1" min={0} placeholder="0" invalid={!!errors.odometer_km} {...register("odometer_km")} />
              </Field>
              <Field label="Service Provider / Vendor" htmlFor="service_provider" error={errors.service_provider?.message}>
                <Input id="service_provider" list="maintenance-providers" placeholder="e.g. Isuzu Calamba Service Center" invalid={!!errors.service_provider} {...register("service_provider")} />
                <datalist id="maintenance-providers">
                  {serviceProviders.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </Field>
              <Field label="Assigned To" htmlFor="assigned_to" error={errors.assigned_to?.message} hint="Mechanic or technician in charge.">
                <Input id="assigned_to" list="maintenance-assignees" placeholder="Select or type a name" invalid={!!errors.assigned_to} {...register("assigned_to")} />
                <datalist id="maintenance-assignees">
                  {assignees.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </Field>
              <Field label="Reminder" htmlFor="reminder_days" error={errors.reminder_days?.message}>
                <Select id="reminder_days" options={MAINTENANCE_REMINDERS} placeholder="No reminder" invalid={!!errors.reminder_days} {...register("reminder_days")} />
              </Field>
              <Field label="Description" htmlFor="description" error={errors.description?.message} className="sm:col-span-2">
                <Textarea id="description" rows={3} maxLength={DESCRIPTION_LIMIT} placeholder="What needs to be done, symptoms, or the work performed" invalid={!!errors.description} {...register("description")} />
                <p className="mt-1 text-right text-xs text-ink-500">
                  {values.description.length}/{DESCRIPTION_LIMIT}
                </p>
              </Field>
              <Field label="Notes / Remarks" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
                <Textarea id="notes" rows={2} maxLength={NOTES_LIMIT} placeholder="Anything else worth noting" invalid={!!errors.notes} {...register("notes")} />
              </Field>
            </CardBody>
          </Card>

          {/* Costs and parts */}
          <Card>
            <CardHeader title="Cost & Parts" icon={<Banknote />} description="Amounts in Philippine Peso (₱)." />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Estimated Cost (₱)" htmlFor="estimated_cost" error={errors.estimated_cost?.message}>
                  <Input id="estimated_cost" type="number" inputMode="decimal" step="0.01" min={0} placeholder="0.00" invalid={!!errors.estimated_cost} {...register("estimated_cost")} />
                </Field>
                <Field label="Actual Cost (₱)" htmlFor="actual_cost" error={errors.actual_cost?.message} hint={values.status === "completed" ? "Total billed for the work." : "Fill in once the work is billed."}>
                  <Input id="actual_cost" type="number" inputMode="decimal" step="0.01" min={0} placeholder="0.00" invalid={!!errors.actual_cost} {...register("actual_cost")} />
                </Field>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-ink-800">Parts &amp; Materials Used</h3>
                  <Button size="sm" variant="secondary" onClick={() => setParts((list) => [...list, { key: ++seq, name: "", quantity: "1", unit_cost: "" }])}>
                    <Plus className="h-3.5 w-3.5" /> Add Part
                  </Button>
                </div>
                {parts.length ? (
                  <div className="space-y-2">
                    <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_8rem_7rem_2.25rem] gap-2 text-xs font-medium text-ink-500 sm:grid">
                      <span>Item</span>
                      <span>Qty</span>
                      <span>Unit Cost (₱)</span>
                      <span className="text-right">Amount</span>
                      <span />
                    </div>
                    {parts.map((p) => (
                      <div key={p.key} className="grid grid-cols-[minmax(0,1fr)_2.25rem] gap-2 rounded-lg border border-ink-100 p-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem_7rem_2.25rem] sm:items-center sm:border-0 sm:p-0">
                        <Input aria-label="Part name" placeholder="e.g. Oil filter" value={p.name} maxLength={120} onChange={(e) => patchPart(p.key, { name: e.target.value })} />
                        <button
                          type="button"
                          onClick={() => setParts((list) => list.filter((x) => x.key !== p.key))}
                          className="row-span-1 flex h-10 w-9 items-center justify-center rounded-md text-ink-500 hover:bg-brand-50 hover:text-brand-700 sm:order-last"
                          aria-label="Remove part"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Input aria-label="Quantity" type="number" inputMode="decimal" min={0} step="any" value={p.quantity} onChange={(e) => patchPart(p.key, { quantity: e.target.value })} />
                        <Input aria-label="Unit cost" type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00" value={p.unit_cost} onChange={(e) => patchPart(p.key, { unit_cost: e.target.value })} />
                        <span className="text-right text-sm tabular-nums text-ink-900 max-sm:col-span-2">{formatCurrency((Number(p.quantity) || 0) * (Number(p.unit_cost) || 0))}</span>
                      </div>
                    ))}
                    <p className="flex justify-end gap-3 border-t border-ink-100 pt-2 text-sm">
                      <span className="text-ink-500">Parts total</span>
                      <span className="font-semibold text-ink-900 tabular-nums">{formatCurrency(partsTotal)}</span>
                    </p>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-ink-200 px-4 py-5 text-center text-sm text-ink-500">No parts added. Use Add Part to list parts or materials used.</p>
                )}
                {partsError && (
                  <p className="mt-2 text-xs font-medium text-brand-700" role="alert">
                    {partsError}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          {/* Live summary */}
          <Card>
            <CardHeader title="Maintenance Summary" icon={<ClipboardList />} />
            <CardBody className="space-y-4">
              <div className="flex gap-3">
                {vehicle?.cover_photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served by the API
                  <img src={api.url(vehicle.cover_photo)} alt={vehicle.plate_number} className="h-16 w-24 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                    <Truck className="h-7 w-7" />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink-900">{vehicle?.plate_number ?? "No vehicle selected"}</p>
                    {vehicle && <StatusBadge status={vehicle.status} map={VEHICLE_STATUS} dot={false} />}
                  </div>
                  {vehicle && (
                    <p className="truncate text-sm text-ink-600">
                      {vehicle.make} {vehicle.model}
                      {vehicle.year ? ` · ${vehicle.year}` : ""}
                    </p>
                  )}
                  {vehicle && <p className="text-xs text-ink-500">Mileage: {vehicle.odometer_km ? `${formatNumber(vehicle.odometer_km)} km` : "—"}</p>}
                </div>
              </div>
              <dl className="space-y-2 border-t border-ink-100 pt-4 text-sm">
                <SummaryRow label="Reference No.">{values.reference_number || "Assigned on save"}</SummaryRow>
                <SummaryRow label="Service Type">{values.service_type ? labelOf(MAINTENANCE_TYPES, values.service_type) : "-"}</SummaryRow>
                <SummaryRow label="Category">{values.category ? labelOf(MAINTENANCE_CATEGORIES, values.category) : "-"}</SummaryRow>
                <SummaryRow label="Status">{shownStatus ? <StatusBadge status={shownStatus} map={MAINTENANCE_STATUS} dot={false} /> : "-"}</SummaryRow>
                <SummaryRow label="Last Service">{!vehicle || !serviceType ? "-" : lastService.isLoading ? "…" : last ? formatDate(last.service_date) : "None recorded"}</SummaryRow>
                <SummaryRow label="Next Due">{values.scheduled_date ? formatDate(values.scheduled_date) : "-"}</SummaryRow>
                <SummaryRow label="Assigned To">{values.assigned_to || "-"}</SummaryRow>
                <SummaryRow label="Estimated Cost">{values.estimated_cost ? formatCurrency(Number(values.estimated_cost)) : "-"}</SummaryRow>
                <SummaryRow label="Actual Cost">{values.actual_cost ? formatCurrency(Number(values.actual_cost)) : "-"}</SummaryRow>
                <SummaryRow label="Reminder">{values.reminder_days ? labelOf(MAINTENANCE_REMINDERS, values.reminder_days) : "None"}</SummaryRow>
              </dl>
            </CardBody>
          </Card>

          {/* Checklist */}
          <Card>
            <CardHeader
              title="Service Checklist"
              icon={<ClipboardCheck />}
              action={
                <span className="text-xs text-ink-500">
                  {checklist.filter((c) => c.done).length}/{checklist.length} done
                </span>
              }
            />
            <CardBody className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {checklist.map((c, i) => (
                  <div key={`${c.item}-${i}`} className="group flex items-center gap-2">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-ink-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-ink-300 accent-brand-600"
                        checked={c.done}
                        onChange={() => setChecklist((list) => list.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                      />
                      {c.item}
                    </label>
                    <button
                      type="button"
                      onClick={() => setChecklist((list) => list.filter((_, j) => j !== i))}
                      className="rounded p-0.5 text-ink-400 opacity-60 hover:text-brand-700 hover:opacity-100"
                      aria-label={`Remove ${c.item}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  aria-label="New checklist item"
                  placeholder="Add checklist item"
                  value={newItem}
                  maxLength={100}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                />
                <Button variant="secondary" onClick={addItem} disabled={!newItem.trim()}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader title="Receipts & Documents" icon={<Paperclip />} description="Job orders, receipts or photos of the work." />
            <CardBody className="space-y-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn("flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition", dragging ? "border-brand-400 bg-brand-50" : "border-ink-200")}
              >
                <CloudUpload className="h-8 w-8 text-ink-400" />
                <p className="text-sm text-ink-600">Drag files here, or</p>
                <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()} disabled={saving}>
                  Browse files
                </Button>
                <p className="text-xs text-ink-500">PDF, JPG or PNG, up to 10 MB each.</p>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              {(stored.length > 0 || pending.length > 0) && (
                <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
                  {stored.map((f) => (
                    <FileRow key={`s${f.id}`} name={f.original_name} meta={formatFileSize(f.file_size)}>
                      <a href={maintenanceService.fileUrl(f)} target="_blank" rel="noopener" className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`View ${f.original_name}`}>
                        <Eye className="h-4 w-4" />
                      </a>
                      <button type="button" onClick={() => removeStored(f)} className="rounded-md p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-700" aria-label={`Remove ${f.original_name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </FileRow>
                  ))}
                  {pending.map((p) => (
                    <FileRow
                      key={`p${p.key}`}
                      name={p.file.name}
                      meta={p.status === "uploading" ? `Uploading… ${Math.round(p.progress * 100)}%` : p.status === "error" ? p.error! : `${formatFileSize(p.file.size)} · uploads when you save`}
                      error={p.status === "error"}
                    >
                      <button
                        type="button"
                        disabled={p.status === "uploading"}
                        onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))}
                        className="rounded-md p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
                        aria-label={`Remove ${p.file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </FileRow>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" onClick={() => router.push(record ? `${MAINTENANCE_PATH}?record=${record.id}` : MAINTENANCE_PATH)} className="min-w-32">
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
        <Button type="submit" size="lg" loading={saving} className="min-w-48">
          <Save className="h-4 w-4" /> {editing ? "Save Changes" : "Save Maintenance"}
        </Button>
      </div>
    </form>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_0.75rem_minmax(0,1fr)] items-start">
      <dt className="whitespace-nowrap text-ink-500">{label}</dt>
      <span className="text-ink-500">:</span>
      <dd className="min-w-0 break-words text-ink-900">{children}</dd>
    </div>
  );
}

function FileRow({ name, meta, error, children }: { name: string; meta: string; error?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{name}</p>
        <p className={cn("truncate text-xs", error ? "font-medium text-brand-700" : "text-ink-500")}>{meta}</p>
      </div>
      {children}
    </li>
  );
}
