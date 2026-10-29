"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Box, Camera, ChevronRight, FileText, ImagePlus, Save, Settings, Star, Truck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { BODY_TYPES, EMISSION_STANDARDS, FUEL_TYPES, VEHICLE_FEATURES, VEHICLE_STATUS, VEHICLE_TYPES, WHEEL_OPTIONS, statusOptions } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api } from "@/services/api-client";
import { driversService, vehiclesService } from "@/services/resources";
import type { Vehicle, VehicleFeature, VehiclePhoto } from "@/types/api";
import { applyApiErrors, nullable } from "../shared";

const VEHICLES_PATH = "/fleet/vehicles";
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const NOTES_LIMIT = 255;
const thisYear = new Date().getFullYear();
const COMMON_MAKES = ["Isuzu", "Fuso", "Hino", "Mitsubishi", "Toyota", "UD Trucks", "Foton", "Hyundai", "Nissan", "Ford"];
const STATUS_DOT: Record<string, string> = { available: "bg-emerald-500", on_trip: "bg-sky-500", maintenance: "bg-orange-500", inactive: "bg-ink-400" };

const optionalNumber = (max: number) => z.union([z.literal(""), z.coerce.number<string>().min(0, "Cannot be negative.").max(max, `At most ${max}.`)]);
const schema = z.object({
  plate_number: z.string().trim().min(1, "Plate number is required.").max(20),
  vehicle_type: z.string().min(1, "Select a vehicle type."),
  make: z.string().trim().min(1, "Brand is required.").max(60),
  model: z.string().trim().min(1, "Model is required.").max(60),
  year: z.coerce.number<string>().int().min(1980, "1980 or later.").max(thisYear + 1, `Up to ${thisYear + 1}.`),
  color: z.string().trim().min(1, "Color is required.").max(30),
  body_type: z.string().min(1, "Select a body type."),
  wheels: z.string().min(1, "Select the number of wheels."),
  vin: z.string().trim().max(50),
  engine_number: z.string().trim().max(50),
  registration_expiry: z.string().min(1, "Registration expiry is required."),
  insurance_expiry: z.string().min(1, "Insurance expiry is required."),
  assigned_driver_id: z.string(),
  home_depot: z.string().trim().max(100),
  status: z.string().min(1, "Select a status."),
  gps_device_id: z.string().trim().max(50),
  odometer_km: z.union([z.literal(""), z.coerce.number<string>().int("Whole kilometres only.").min(0).max(5_000_000)]),
  acquired_at: z.string().refine((v) => !v || v <= new Date().toISOString().slice(0, 10), "Can't be in the future."),
  capacity_kg: z.coerce.number<string>({ message: "Load capacity is required." }).positive("Load capacity is required.").max(100_000),
  cargo_volume_m3: optionalNumber(500),
  length_m: optionalNumber(30),
  width_m: optionalNumber(5),
  height_m: optionalNumber(6),
  notes: z.string().max(NOTES_LIMIT, `Up to ${NOTES_LIMIT} characters.`),
  fuel_type: z.string().min(1, "Select a fuel type."),
  fuel_tank_l: optionalNumber(2000),
  fuel_economy_kml: optionalNumber(100),
  emission_standard: z.string(),
  features: z.array(z.string()),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
const FIELDS = Object.keys(schema.shape);

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
function defaults(v?: Vehicle | null): FormInput {
  return {
    plate_number: str(v?.plate_number),
    vehicle_type: str(v?.vehicle_type),
    make: str(v?.make),
    model: str(v?.model),
    year: str(v?.year ?? thisYear),
    color: str(v?.color),
    body_type: str(v?.body_type),
    wheels: str(v?.wheels),
    vin: str(v?.vin),
    engine_number: str(v?.engine_number),
    registration_expiry: str(v?.registration_expiry),
    insurance_expiry: str(v?.insurance_expiry),
    assigned_driver_id: str(v?.assigned_driver_id),
    home_depot: str(v?.home_depot),
    status: v?.status ?? "available",
    gps_device_id: str(v?.gps_device_id),
    odometer_km: str(v?.odometer_km),
    acquired_at: str(v?.acquired_at),
    capacity_kg: str(v?.capacity_kg),
    cargo_volume_m3: str(v?.cargo_volume_m3),
    length_m: str(v?.length_m),
    width_m: str(v?.width_m),
    height_m: str(v?.height_m),
    notes: str(v?.notes),
    fuel_type: v?.fuel_type ?? "diesel",
    fuel_tank_l: str(v?.fuel_tank_l),
    fuel_economy_kml: str(v?.fuel_economy_kml),
    emission_standard: str(v?.emission_standard),
    features: v?.features ?? [],
  };
}

/** `/fleet/vehicles/create` and `/fleet/vehicles/[id]/edit`. */
export function VehicleEditor({ vehicleId }: { vehicleId?: number }) {
  const { canManageFleet } = usePermissions();
  const existing = useQuery({ queryKey: ["vehicle", vehicleId], queryFn: () => vehiclesService.get(vehicleId!).then((r) => r.data), enabled: !!vehicleId });

  if (!canManageFleet) return <ErrorState message="You do not have permission to add or edit vehicles." />;
  if (vehicleId) {
    if (existing.isLoading) return <LoadingState label="Loading vehicle…" />;
    if (existing.error || !existing.data) return <ErrorState message={existing.error?.message ?? "Vehicle not found."} onRetry={() => existing.refetch()} />;
    return <VehicleForm key={existing.data.id} vehicle={existing.data} />;
  }
  return <VehicleForm />;
}

/** A photo chosen in the browser but not uploaded yet (new vehicles upload after saving). */
interface PendingPhoto {
  key: string;
  file: File;
  url: string;
}

function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  const router = useRouter();
  const notify = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = !!vehicle;

  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: defaults(vehicle) });

  const drivers = useQuery({ queryKey: ["drivers", "options"], queryFn: () => driversService.list({ per_page: 100, sort: "full_name" }) });
  const fleet = useQuery({ queryKey: ["vehicles", "options"], queryFn: () => vehiclesService.list({ per_page: 100, sort: "plate_number" }) });
  const makes = useMemo(() => [...new Set([...COMMON_MAKES, ...(fleet.data?.data ?? []).map((v) => v.make)])].sort(), [fleet.data]);
  const depots = useMemo(() => [...new Set((fleet.data?.data ?? []).map((v) => v.home_depot).filter((d): d is string => !!d))].sort(), [fleet.data]);

  const [driverId, status, features, notes] = watch(["assigned_driver_id", "status", "features", "notes"]);
  const driver = drivers.data?.data.find((d) => String(d.id) === driverId);

  // ----- Photos ------------------------------------------------------------------
  const [saved, setSaved] = useState<VehiclePhoto[]>(vehicle?.photos ?? []);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [selected, setSelected] = useState(0);
  useEffect(() => () => pending.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const gallery = [...saved.map((p) => ({ key: `saved-${p.id}`, url: api.url(p.path), saved: p })), ...pending.map((p) => ({ key: p.key, url: p.url, saved: undefined as VehiclePhoto | undefined }))];
  const current = gallery[Math.min(selected, gallery.length - 1)];

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - gallery.length;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (!["image/jpeg", "image/png"].includes(file.type)) notify(`${file.name}: only JPG or PNG photos.`, "error");
      else if (file.size > MAX_PHOTO_BYTES) notify(`${file.name} is over 5 MB.`, "error");
      else if (accepted.length >= room) notify(`Up to ${MAX_PHOTOS} photos per vehicle.`, "error");
      else accepted.push(file);
    }
    if (!accepted.length) return;

    if (vehicle) {
      // Existing vehicles: upload right away.
      for (const file of accepted) {
        try {
          const result = await vehiclesService.uploadPhoto(vehicle.id, file);
          setSaved((list) => [...list, result.data]);
        } catch (error) {
          notify(error instanceof Error ? error.message : `Could not upload ${file.name}.`, "error");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicle.id] });
    } else {
      setPending((list) => [...list, ...accepted.map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, url: URL.createObjectURL(file) }))]);
    }
    setSelected(gallery.length);
  };

  const removePhoto = async (key: string) => {
    const item = gallery.find((g) => g.key === key);
    if (!item) return;
    if (item.saved && vehicle) {
      try {
        await vehiclesService.removePhoto(vehicle.id, item.saved.id);
        setSaved((list) => list.filter((p) => p.id !== item.saved!.id));
        queryClient.invalidateQueries({ queryKey: ["vehicle", vehicle.id] });
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not remove the photo.", "error");
        return;
      }
    } else {
      setPending((list) => {
        const gone = list.find((p) => p.key === key);
        if (gone) URL.revokeObjectURL(gone.url);
        return list.filter((p) => p.key !== key);
      });
    }
    setSelected(0);
  };

  const makeCover = async (key: string) => {
    const item = gallery.find((g) => g.key === key);
    if (!item) return;
    if (item.saved && vehicle) {
      await vehiclesService.makeCover(vehicle.id, item.saved.id);
      setSaved((list) => [item.saved!, ...list.filter((p) => p.id !== item.saved!.id)]);
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicle.id] });
    } else {
      setPending((list) => [...list.filter((p) => p.key === key), ...list.filter((p) => p.key !== key)]);
    }
    setSelected(0);
  };

  // ----- Save --------------------------------------------------------------------
  const mutation = useApiMutation(
    (values: FormOutput) => {
      const payload = nullable({
        ...values,
        assigned_driver_id: values.assigned_driver_id ? Number(values.assigned_driver_id) : "",
        wheels: values.wheels ? Number(values.wheels) : "",
        features: values.features,
      });
      return vehicle ? vehiclesService.update(vehicle.id, payload) : vehiclesService.create(payload);
    },
    { invalidate: [["vehicles"], ["vehicle"], ["dashboard"], ["monitoring"], ["documents"], ["gps"]] },
  );

  const submit = handleSubmit(
    async (values) => {
      setFormError(null);
      setSaving(true);
      try {
        const result = await mutation.mutateAsync(values);
        // New vehicles: upload the chosen photos now that the vehicle exists (cover first).
        let failed = 0;
        for (const photo of pending) {
          try {
            await vehiclesService.uploadPhoto(result.data.id, photo.file);
          } catch {
            failed++;
          }
        }
        if (failed) notify(`${failed} photo${failed === 1 ? "" : "s"} could not be uploaded. Add them again from Edit Vehicle.`, "error");
        router.push(VEHICLES_PATH);
      } catch (error) {
        setFormError(applyApiErrors(error, setError as UseFormSetError<FormInput>, FIELDS));
      } finally {
        setSaving(false);
      }
    },
    () => setFormError("Some details are missing or invalid. Check the highlighted fields."),
  );

  const toggleFeature = (feature: VehicleFeature) =>
    setValue("features", features.includes(feature) ? features.filter((f) => f !== feature) : [...features, feature], { shouldDirty: true });

  return (
    <form onSubmit={submit} noValidate>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{editing ? `Edit Vehicle ${vehicle.plate_number}` : "Add Vehicle"}</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">{editing ? "Update this vehicle's details, capacity and photos." : "Register a new vehicle to your fleet."}</p>
        </div>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-500">
          <span>Fleet &amp; Drivers</span>
          <ChevronRight className="h-4 w-4" />
          <Link href={VEHICLES_PATH} className="hover:text-ink-900">
            Vehicles
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-ink-900">{editing ? "Edit Vehicle" : "Add Vehicle"}</span>
        </nav>
      </div>

      {formError && (
        <div className="mb-5">
          <FormError message={formError} />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Basic information */}
        <Card>
          <CardHeader title="Basic Information" icon={<Truck />} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Plate Number" htmlFor="plate_number" error={errors.plate_number?.message} required>
              <Input id="plate_number" placeholder="ABC-1234" className="uppercase" invalid={!!errors.plate_number} {...register("plate_number")} />
            </Field>
            <Field label="Vehicle Type" htmlFor="vehicle_type" error={errors.vehicle_type?.message} required>
              <Select id="vehicle_type" options={VEHICLE_TYPES} placeholder="Select type" invalid={!!errors.vehicle_type} {...register("vehicle_type")} />
            </Field>
            <Field label="Brand" htmlFor="make" error={errors.make?.message} required>
              <Input id="make" list="vehicle-makes" placeholder="Fuso" invalid={!!errors.make} {...register("make")} />
              <datalist id="vehicle-makes">
                {makes.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Model" htmlFor="model" error={errors.model?.message} required>
              <Input id="model" placeholder="Canter" invalid={!!errors.model} {...register("model")} />
            </Field>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
              <Field label="Year" htmlFor="year" error={errors.year?.message} required>
                <Input id="year" type="number" min={1980} max={thisYear + 1} invalid={!!errors.year} {...register("year")} />
              </Field>
              <Field label="Color" htmlFor="color" error={errors.color?.message} required>
                <Input id="color" placeholder="White" invalid={!!errors.color} {...register("color")} />
              </Field>
              <Field label="Body Type" htmlFor="body_type" error={errors.body_type?.message} required>
                <Select id="body_type" options={BODY_TYPES} placeholder="Select body type" invalid={!!errors.body_type} {...register("body_type")} />
              </Field>
            </div>
            <Field label="No. of Wheels" htmlFor="wheels" error={errors.wheels?.message} required>
              <Select id="wheels" options={WHEEL_OPTIONS} placeholder="Select" invalid={!!errors.wheels} {...register("wheels")} />
            </Field>
            <Field label="VIN / Chassis No." htmlFor="vin" error={errors.vin?.message}>
              <Input id="vin" className="uppercase" invalid={!!errors.vin} {...register("vin")} />
            </Field>
            <Field label="Engine No." htmlFor="engine_number" error={errors.engine_number?.message}>
              <Input id="engine_number" className="uppercase" invalid={!!errors.engine_number} {...register("engine_number")} />
            </Field>
            <Field label="Registration Expiry" htmlFor="registration_expiry" error={errors.registration_expiry?.message} required hint="Saved as the vehicle's registration document.">
              <Input id="registration_expiry" type="date" invalid={!!errors.registration_expiry} {...register("registration_expiry")} />
            </Field>
            <div className="hidden sm:block" />
            <Field label="Insurance Expiry" htmlFor="insurance_expiry" error={errors.insurance_expiry?.message} required hint="Saved as the vehicle's insurance document.">
              <Input id="insurance_expiry" type="date" invalid={!!errors.insurance_expiry} {...register("insurance_expiry")} />
            </Field>
          </CardBody>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader title="Vehicle Image" icon={<Camera />} />
          <CardBody>
            <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-lg border border-ink-100 bg-ink-50">
              {current ? (
                // eslint-disable-next-line @next/next/no-img-element -- served by the API / local preview, not a static asset
                <img src={current.url} alt="Vehicle" className="h-full w-full object-cover" />
              ) : (
                <button type="button" onClick={() => fileInput.current?.click()} className="flex flex-col items-center gap-2 text-ink-500 hover:text-brand-600">
                  <ImagePlus className="h-10 w-10" />
                  <span className="text-sm font-medium">Add a photo</span>
                </button>
              )}
              {current && (
                <button type="button" onClick={() => fileInput.current?.click()} disabled={gallery.length >= MAX_PHOTOS} className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg bg-ink-900/80 px-3 py-1.5 text-sm text-white hover:bg-ink-900 disabled:opacity-50">
                  <Camera className="h-4 w-4" /> Add Photo
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="mt-3 grid grid-cols-5 gap-2">
              {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                const item = gallery[i];
                if (!item)
                  return (
                    <button key={`slot-${i}`} type="button" onClick={() => fileInput.current?.click()} className="flex aspect-[4/3] items-center justify-center rounded-lg border-2 border-dashed border-ink-200 text-ink-300 hover:border-brand-300 hover:text-brand-500" aria-label="Add photo">
                      <ImagePlus className="h-5 w-5" />
                    </button>
                  );
                return (
                  <div key={item.key} className={cn("group relative aspect-[4/3] overflow-hidden rounded-lg border-2", i === selected ? "border-brand-600" : "border-transparent")}>
                    <button type="button" onClick={() => setSelected(i)} className="h-full w-full" aria-label={`Show photo ${i + 1}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by the API / local preview */}
                      <img src={item.url} alt="" className="h-full w-full object-cover" />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-brand-600 px-1 text-[10px] font-semibold text-white">Cover</span>}
                    <div className="absolute top-1 right-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      {i !== 0 && (
                        <button type="button" onClick={() => makeCover(item.key)} className="rounded bg-white/90 p-0.5 text-ink-700 hover:text-amber-600" aria-label="Make cover photo" title="Make cover">
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button type="button" onClick={() => removePhoto(item.key)} className="rounded bg-white/90 p-0.5 text-ink-700 hover:text-brand-600" aria-label="Remove photo" title="Remove">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-500">
              Upload up to {MAX_PHOTOS} photos. Supported formats: JPG, PNG (max 5 MB each).{!editing && pending.length > 0 && " Photos upload when you save."}
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        {/* Operational details */}
        <Card>
          <CardHeader title="Operational Details" icon={<Settings />} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Assigned Driver" htmlFor="assigned_driver_id" error={errors.assigned_driver_id?.message}>
              <div className="relative">
                {driver && <Avatar name={driver.full_name} size="sm" className="pointer-events-none absolute top-1/2 left-1.5 h-7 w-7 -translate-y-1/2 text-[10px]" />}
                {/* Remounts once the options load so the saved driver is selected. */}
                <Select
                  key={drivers.data ? "loaded" : "loading"}
                  id="assigned_driver_id"
                  className={cn(driver && "pl-10")}
                  options={(drivers.data?.data ?? []).map((d) => ({
                    value: String(d.id),
                    label: `${d.full_name}${d.assigned_vehicle && d.assigned_vehicle.id !== vehicle?.id ? ` (on ${d.assigned_vehicle.plate_number})` : ""}`,
                  }))}
                  placeholder="No assigned driver"
                  {...register("assigned_driver_id")}
                />
              </div>
            </Field>
            <Field label="Home Garage / Depot" htmlFor="home_depot" error={errors.home_depot?.message}>
              <Input id="home_depot" list="vehicle-depots" placeholder="Main Warehouse" {...register("home_depot")} />
              <datalist id="vehicle-depots">
                {depots.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
            <Field label="Current Status" htmlFor="status" error={errors.status?.message} required>
              <div className="relative">
                <span className={cn("pointer-events-none absolute top-1/2 left-3 h-2.5 w-2.5 -translate-y-1/2 rounded-full", STATUS_DOT[status] ?? "bg-ink-300")} />
                <Select id="status" className="pl-8" options={statusOptions(VEHICLE_STATUS)} {...register("status")} />
              </div>
            </Field>
            <Field label="GPS Device ID" htmlFor="gps_device_id" error={errors.gps_device_id?.message}>
              <Input id="gps_device_id" placeholder="GPS-00123" invalid={!!errors.gps_device_id} {...register("gps_device_id")} />
            </Field>
            <Field label="Odometer (km)" htmlFor="odometer_km" error={errors.odometer_km?.message}>
              <Input id="odometer_km" type="number" min={0} step={1} invalid={!!errors.odometer_km} {...register("odometer_km")} />
            </Field>
            <Field label="Date Acquired" htmlFor="acquired_at" error={errors.acquired_at?.message}>
              <Input id="acquired_at" type="date" max={new Date().toISOString().slice(0, 10)} invalid={!!errors.acquired_at} {...register("acquired_at")} />
            </Field>
          </CardBody>
        </Card>

        {/* Capacity */}
        <Card>
          <CardHeader title="Capacity & Dimensions" icon={<Box />} />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Load Capacity (kg)" htmlFor="capacity_kg" error={errors.capacity_kg?.message} required>
              <Input id="capacity_kg" type="number" min={0} invalid={!!errors.capacity_kg} {...register("capacity_kg")} />
            </Field>
            <Field label="Cargo Volume (m³)" htmlFor="cargo_volume_m3" error={errors.cargo_volume_m3?.message}>
              <Input id="cargo_volume_m3" type="number" min={0} step="0.1" invalid={!!errors.cargo_volume_m3} {...register("cargo_volume_m3")} />
            </Field>
            <Field label="Length (m)" htmlFor="length_m" error={errors.length_m?.message}>
              <Input id="length_m" type="number" min={0} step="0.1" invalid={!!errors.length_m} {...register("length_m")} />
            </Field>
            <Field label="Width (m)" htmlFor="width_m" error={errors.width_m?.message}>
              <Input id="width_m" type="number" min={0} step="0.1" invalid={!!errors.width_m} {...register("width_m")} />
            </Field>
            <Field label="Height (m)" htmlFor="height_m" error={errors.height_m?.message}>
              <Input id="height_m" type="number" min={0} step="0.1" invalid={!!errors.height_m} {...register("height_m")} />
            </Field>
            <div className="hidden sm:block" />
            <Field label="Remarks" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-3">
              <Textarea id="notes" rows={3} maxLength={NOTES_LIMIT} placeholder="e.g. Standard closed van for general cargo." {...register("notes")} />
              <p className="mt-1 text-right text-xs text-ink-500">
                {notes.length}/{NOTES_LIMIT}
              </p>
            </Field>
          </CardBody>
        </Card>

        {/* Additional */}
        <Card className="lg:col-span-2 2xl:col-span-1">
          <CardHeader title="Additional Information" icon={<FileText />} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Fuel Type" htmlFor="fuel_type" error={errors.fuel_type?.message} required>
              <Select id="fuel_type" options={FUEL_TYPES} {...register("fuel_type")} />
            </Field>
            <Field label="Fuel Tank Capacity (L)" htmlFor="fuel_tank_l" error={errors.fuel_tank_l?.message}>
              <Input id="fuel_tank_l" type="number" min={0} invalid={!!errors.fuel_tank_l} {...register("fuel_tank_l")} />
            </Field>
            <Field label="Fuel Consumption (km/L)" htmlFor="fuel_economy_kml" error={errors.fuel_economy_kml?.message}>
              <Input id="fuel_economy_kml" type="number" min={0} step="0.1" invalid={!!errors.fuel_economy_kml} {...register("fuel_economy_kml")} />
            </Field>
            <Field label="Emission Standard" htmlFor="emission_standard" error={errors.emission_standard?.message}>
              <Select id="emission_standard" options={EMISSION_STANDARDS} placeholder="Select" {...register("emission_standard")} />
            </Field>
            <div className="space-y-2 sm:col-span-2">
              {VEHICLE_FEATURES.map((f) => (
                <Checkbox key={f.value} label={f.label} checked={features.includes(f.value)} onChange={() => toggleFeature(f.value)} />
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="secondary" size="lg" onClick={() => router.push(editing ? `${VEHICLES_PATH}/${vehicle.id}` : VEHICLES_PATH)} className="min-w-32">
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
        <Button type="submit" size="lg" loading={saving} className="min-w-44">
          <Save className="h-4 w-4" /> {editing ? "Save Changes" : "Save Vehicle"}
        </Button>
      </div>
    </form>
  );
}
