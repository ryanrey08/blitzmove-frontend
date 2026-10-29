"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, Camera, ChevronRight, IdCard, ImagePlus, PhoneCall, Save, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { DRIVER_STATUS, LICENSE_TYPES, statusOptions } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api } from "@/services/api-client";
import { driversService, vehiclesService } from "@/services/resources";
import type { Driver } from "@/types/api";
import { applyApiErrors, nullable } from "../shared";
import { DRIVERS_PATH } from "./drivers-view";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const NOTES_LIMIT = 255;
const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-500",
  on_trip: "bg-sky-500",
  on_leave: "bg-amber-500",
  suspended: "bg-brand-600",
  inactive: "bg-ink-400",
};
const RELATIONS = ["Spouse", "Parent", "Sibling", "Child", "Relative", "Friend", "Other"];
const today = () => new Date().toISOString().slice(0, 10);
const adultCutoff = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
};

const schema = z
  .object({
    full_name: z.string().trim().min(1, "Full name is required.").max(255),
    date_of_birth: z.string().refine((v) => !v || v <= adultCutoff(), "Drivers must be at least 18 years old."),
    phone: z.string().trim().min(1, "Contact number is required.").max(30),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.")]),
    address: z.string().max(255),
    license_number: z.string().trim().min(1, "License number is required.").max(50),
    license_type: z.string().min(1, "Select a license type."),
    license_expiry: z.string().min(1, "Expiry date is required."),
    license_restrictions: z.string().trim().max(100),
    date_hired: z.string().refine((v) => !v || v <= today(), "Can't be in the future."),
    status: z.string().min(1, "Select a status."),
    assigned_vehicle_id: z.string(),
    emergency_contact_name: z.string().trim().max(255),
    emergency_contact_phone: z.string().trim().max(30),
    emergency_contact_relation: z.string().max(50),
    notes: z.string().max(NOTES_LIMIT, `Up to ${NOTES_LIMIT} characters.`),
  })
  .refine((v) => !v.emergency_contact_name || v.emergency_contact_phone, {
    path: ["emergency_contact_phone"],
    message: "Add a number for the emergency contact.",
  });
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
const FIELDS = [...Object.keys(schema.shape)];

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
function defaults(d?: Driver | null): FormInput {
  return {
    full_name: str(d?.full_name),
    date_of_birth: str(d?.date_of_birth),
    phone: str(d?.phone),
    email: str(d?.email),
    address: str(d?.address),
    license_number: str(d?.license_number),
    license_type: d?.license_type ?? "professional",
    license_expiry: str(d?.license_expiry),
    license_restrictions: str(d?.license_restrictions),
    date_hired: str(d?.date_hired),
    status: d?.status ?? "available",
    assigned_vehicle_id: str(d?.assigned_vehicle?.id),
    emergency_contact_name: str(d?.emergency_contact_name),
    emergency_contact_phone: str(d?.emergency_contact_phone),
    emergency_contact_relation: str(d?.emergency_contact_relation),
    notes: str(d?.notes),
  };
}

/** `/fleet/drivers/create` and `/fleet/drivers/[id]/edit` (same layout as Add Vehicle). */
export function DriverEditor({ driverId }: { driverId?: number }) {
  const { canManageFleet } = usePermissions();
  const existing = useQuery({
    queryKey: ["driver", driverId, "form"],
    queryFn: () => driversService.get(driverId!).then((r) => r.data),
    enabled: !!driverId,
  });

  if (!canManageFleet) return <ErrorState message="You do not have permission to add or edit drivers." />;
  if (driverId) {
    if (existing.isLoading) return <LoadingState label="Loading driver…" />;
    if (existing.error || !existing.data) return <ErrorState message={existing.error?.message ?? "Driver not found."} onRetry={() => existing.refetch()} />;
    return <DriverForm key={existing.data.id} driver={existing.data} />;
  }
  return <DriverForm />;
}

function DriverForm({ driver }: { driver?: Driver }) {
  const router = useRouter();
  const notify = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = !!driver;

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaults(driver),
  });
  const [status, notes, fullName] = watch(["status", "notes", "full_name"]);

  const vehicles = useQuery({
    queryKey: ["vehicles", "options"],
    queryFn: () => vehiclesService.list({ per_page: 100, sort: "plate_number" }),
  });
  const vehicleOptions = (vehicles.data?.data ?? []).map((v) => {
    const takenBy = v.assigned_driver && v.assigned_driver.id !== driver?.id ? v.assigned_driver.full_name : null;
    return {
      value: String(v.id),
      label: `${v.plate_number} · ${v.make} ${v.model}${takenBy ? ` (driven by ${takenBy})` : ""}`,
    };
  });

  // ----- Photo: uploaded right away when editing, after saving for a new driver ----------
  const [photoUrl, setPhotoUrl] = useState<string | null>(driver?.photo ? `${api.url(driver.photo)}?v=${driver.updated_at}` : null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  useEffect(
    () => () => {
      if (photoUrl?.startsWith("blob:")) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) return notify("Photos must be JPG or PNG.", "error");
    if (file.size > MAX_PHOTO_BYTES) return notify("Photos can be up to 5 MB.", "error");
    if (driver) {
      try {
        const result = await driversService.uploadPhoto(driver.id, file);
        setPhotoUrl(`${api.url(result.data.photo)}?v=${Date.now()}`);
        notify(result.message);
        queryClient.invalidateQueries({ queryKey: ["driver", driver.id] });
        queryClient.invalidateQueries({ queryKey: ["drivers"] });
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not upload the photo.", "error");
      }
    } else {
      setPendingPhoto(file);
      setPhotoUrl(URL.createObjectURL(file));
    }
  };

  const removePhoto = async () => {
    if (driver?.photo && !pendingPhoto) {
      try {
        await driversService.removePhoto(driver.id);
        queryClient.invalidateQueries({ queryKey: ["driver", driver.id] });
        queryClient.invalidateQueries({ queryKey: ["drivers"] });
      } catch (error) {
        return notify(error instanceof Error ? error.message : "Could not remove the photo.", "error");
      }
    }
    setPendingPhoto(null);
    setPhotoUrl(null);
  };

  // ----- Save --------------------------------------------------------------------------
  const mutation = useApiMutation(
    (values: FormOutput) => {
      const payload = nullable({
        ...values,
        assigned_vehicle_id: values.assigned_vehicle_id ? Number(values.assigned_vehicle_id) : "",
      });
      return driver ? driversService.update(driver.id, payload) : driversService.create(payload);
    },
    {
      invalidate: [["drivers"], ["driver"], ["vehicles"], ["vehicle"], ["dashboard"], ["monitoring"]],
    },
  );

  const submit = handleSubmit(
    async (values) => {
      setFormError(null);
      setSaving(true);
      try {
        const result = await mutation.mutateAsync(values);
        if (pendingPhoto) {
          try {
            await driversService.uploadPhoto(result.data.id, pendingPhoto);
          } catch {
            notify("The driver was saved, but the photo could not be uploaded. Add it again from Edit Driver.", "error");
          }
        }
        router.push(DRIVERS_PATH);
      } catch (error) {
        setFormError(applyApiErrors(error, setError as UseFormSetError<FormInput>, FIELDS));
      } finally {
        setSaving(false);
      }
    },
    () => setFormError("Some details are missing or invalid. Check the highlighted fields."),
  );

  return (
    <form onSubmit={submit} noValidate>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{editing ? `Edit Driver ${driver.full_name}` : "Add Driver"}</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">{editing ? "Update this driver's details, license and assignment." : "Register a new driver to your fleet."}</p>
        </div>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-500">
          <span>Fleet &amp; Drivers</span>
          <ChevronRight className="h-4 w-4" />
          <Link href={DRIVERS_PATH} className="hover:text-ink-900">
            Drivers
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-ink-900">{editing ? "Edit Driver" : "Add Driver"}</span>
        </nav>
      </div>

      {formError && (
        <div className="mb-5">
          <FormError message={formError} />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Personal information */}
        <Card>
          <CardHeader title="Personal Information" icon={<UserRound />} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" htmlFor="full_name" error={errors.full_name?.message} required className="sm:col-span-2">
              <Input id="full_name" placeholder="Juan Cruz" invalid={!!errors.full_name} {...register("full_name")} />
            </Field>
            <Field label="Driver ID" htmlFor="employee_code" hint={editing ? undefined : "Assigned automatically when you save."}>
              <Input id="employee_code" value={driver?.employee_code ?? "Auto-generated"} readOnly className="bg-ink-50 font-medium" />
            </Field>
            <Field label="Date of Birth" htmlFor="date_of_birth" error={errors.date_of_birth?.message}>
              <Input id="date_of_birth" type="date" max={adultCutoff()} invalid={!!errors.date_of_birth} {...register("date_of_birth")} />
            </Field>
            <Field label="Contact No." htmlFor="phone" error={errors.phone?.message} required>
              <Input id="phone" type="tel" placeholder="0917 555 1234" invalid={!!errors.phone} {...register("phone")} />
            </Field>
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" placeholder="juan.cruz@example.com" invalid={!!errors.email} {...register("email")} />
            </Field>
            <Field label="Address" htmlFor="address" error={errors.address?.message} className="sm:col-span-2">
              <Input id="address" placeholder="Street, City, Province" invalid={!!errors.address} {...register("address")} />
            </Field>
          </CardBody>
        </Card>

        {/* Photo */}
        <Card>
          <CardHeader title="Driver Photo" icon={<Camera />} />
          <CardBody>
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-ink-100 bg-ink-50">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- served by the API / local preview
                <img src={photoUrl} alt={fullName || "Driver"} className="h-full w-full object-cover" />
              ) : fullName.trim() ? (
                <Avatar name={fullName} size="lg" className="h-28 w-28 text-4xl" />
              ) : (
                <button type="button" onClick={() => fileInput.current?.click()} className="flex flex-col items-center gap-2 text-ink-500 hover:text-brand-600">
                  <ImagePlus className="h-10 w-10" />
                  <span className="text-sm font-medium">Add a photo</span>
                </button>
              )}
              <div className="absolute right-3 bottom-3 flex gap-2">
                {photoUrl && (
                  <button type="button" onClick={removePhoto} className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-sm text-ink-700 shadow hover:text-brand-700">
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                )}
                <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-1.5 rounded-lg bg-ink-900/80 px-3 py-1.5 text-sm text-white hover:bg-ink-900">
                  <Camera className="h-4 w-4" /> {photoUrl ? "Change Photo" : "Upload Photo"}
                </button>
              </div>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => {
                pickPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="mt-2 text-xs text-ink-500">
              One photo. Supported formats: JPG, PNG (max 5 MB).
              {!editing && pendingPhoto && " It uploads when you save."}
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {/* License */}
        <Card>
          <CardHeader title="License Information" icon={<IdCard />} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="License No." htmlFor="license_number" error={errors.license_number?.message} required>
              <Input id="license_number" placeholder="N01-23-456789" className="uppercase" invalid={!!errors.license_number} {...register("license_number")} />
            </Field>
            <Field label="License Type" htmlFor="license_type" error={errors.license_type?.message} required>
              <Select id="license_type" options={LICENSE_TYPES} {...register("license_type")} />
            </Field>
            <Field label="Expiry Date" htmlFor="license_expiry" error={errors.license_expiry?.message} required>
              <Input id="license_expiry" type="date" invalid={!!errors.license_expiry} {...register("license_expiry")} />
            </Field>
            <Field label="Restrictions" htmlFor="license_restrictions" error={errors.license_restrictions?.message} hint="e.g. 1, 2, 3 or None">
              <Input id="license_restrictions" placeholder="None" {...register("license_restrictions")} />
            </Field>
          </CardBody>
        </Card>

        {/* Employment */}
        <Card>
          <CardHeader title="Employment & Assignment" icon={<Briefcase />} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Current Status" htmlFor="status" error={errors.status?.message} required>
              <div className="relative">
                <span className={cn("pointer-events-none absolute top-1/2 left-3 h-2.5 w-2.5 -translate-y-1/2 rounded-full", STATUS_DOT[status] ?? "bg-ink-300")} />
                <Select id="status" className="pl-8" options={statusOptions(DRIVER_STATUS)} {...register("status")} />
              </div>
            </Field>
            <Field label="Date Hired" htmlFor="date_hired" error={errors.date_hired?.message}>
              <Input id="date_hired" type="date" max={today()} invalid={!!errors.date_hired} {...register("date_hired")} />
            </Field>
            <Field label="Assigned Vehicle" htmlFor="assigned_vehicle_id" error={errors.assigned_vehicle_id?.message} hint="The vehicle this driver usually drives." className="sm:col-span-2">
              {/* Remounts once the options load so the saved vehicle is selected. */}
              <Select key={vehicles.data ? "loaded" : "loading"} id="assigned_vehicle_id" options={vehicleOptions} placeholder="No assigned vehicle" invalid={!!errors.assigned_vehicle_id} {...register("assigned_vehicle_id")} />
            </Field>
            <Field label="Remarks" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
              <Textarea id="notes" rows={2} maxLength={NOTES_LIMIT} {...register("notes")} />
              <p className="mt-1 text-right text-xs text-ink-500">
                {notes.length}/{NOTES_LIMIT}
              </p>
            </Field>
          </CardBody>
        </Card>

        {/* Emergency contact */}
        <Card className="lg:col-span-2 2xl:col-span-1">
          <CardHeader title="Emergency Contact" icon={<PhoneCall />} />
          <CardBody className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">
            <Field label="Contact Person" htmlFor="emergency_contact_name" error={errors.emergency_contact_name?.message}>
              <Input id="emergency_contact_name" placeholder="Maria Cruz" {...register("emergency_contact_name")} />
            </Field>
            <Field label="Contact No." htmlFor="emergency_contact_phone" error={errors.emergency_contact_phone?.message}>
              <Input id="emergency_contact_phone" type="tel" invalid={!!errors.emergency_contact_phone} {...register("emergency_contact_phone")} />
            </Field>
            <Field label="Relationship" htmlFor="emergency_contact_relation" error={errors.emergency_contact_relation?.message}>
              <Select id="emergency_contact_relation" options={RELATIONS.map((r) => ({ value: r, label: r }))} placeholder="Select" {...register("emergency_contact_relation")} />
            </Field>
          </CardBody>
        </Card>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="secondary" size="lg" onClick={() => router.push(DRIVERS_PATH)} className="min-w-32">
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
        <Button type="submit" size="lg" loading={saving} className="min-w-44">
          <Save className="h-4 w-4" /> {editing ? "Save Changes" : "Save Driver"}
        </Button>
      </div>
    </form>
  );
}
