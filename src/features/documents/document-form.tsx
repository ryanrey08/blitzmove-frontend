"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { DRIVER_DOCUMENT_TYPES, VEHICLE_DOCUMENT_TYPES } from "@/lib/constants";
import { formatFileSize } from "@/lib/utils";
import { ApiError } from "@/services/api-client";
import { documentsService } from "@/services/resources";
import type { DocumentOwner, FleetDocument } from "@/types/api";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { applyApiErrors } from "../shared";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";

const schema = z
  .object({
    owner_id: z.string().min(1, "Select an owner."),
    document_type: z.string().min(1, "Select a document type."),
    title: z.string().trim().min(1, "Title is required.").max(255),
    document_number: z.string().max(80),
    issued_at: z.string(),
    expires_at: z.string(),
    notes: z.string().max(255),
  })
  .refine((v) => !v.issued_at || !v.expires_at || v.expires_at >= v.issued_at, { path: ["expires_at"], message: "Expiry must be on or after the issue date." });
type FormValues = z.infer<typeof schema>;
const FIELDS = [...Object.keys(schema.shape), "file"];

interface Props {
  open: boolean;
  owner: DocumentOwner;
  document?: FleetDocument | null;
  defaultOwnerId?: string;
  onClose: () => void;
}

export function DocumentFormModal({ open, owner, document, defaultOwnerId, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { vehicleOptions, driverOptions } = useFleetOptions(open);
  const ownerOptions = owner === "vehicle" ? vehicleOptions : driverOptions;
  const types = owner === "vehicle" ? VEHICLE_DOCUMENT_TYPES : DRIVER_DOCUMENT_TYPES;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      owner_id: document ? String(document.vehicle_id ?? document.driver_id) : (defaultOwnerId ?? ""),
      document_type: document?.document_type ?? "",
      title: document?.title ?? "",
      document_number: document?.document_number ?? "",
      issued_at: document?.issued_at ?? "",
      expires_at: document?.expires_at ?? "",
      notes: document?.notes ?? "",
    },
  });

  const close = () => {
    setFile(null);
    setFileError(null);
    setFormError(null);
    onClose();
  };

  const mutation = useApiMutation(
    (values: FormValues) => {
      const form = new FormData();
      const { owner_id, ...rest } = values;
      Object.entries(rest).forEach(([k, v]) => form.append(k, v));
      if (file) form.append("file", file);
      if (document) return documentsService.update(owner, document.id, form);
      form.append("owner_type", owner);
      form.append("owner_id", owner_id);
      return documentsService.create(form);
    },
    { invalidate: [["documents"], ["monitoring"], ["vehicle"], ["driver"]], onSuccess: close },
  );

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    if (fileError) return;
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, FIELDS));
      if (error instanceof ApiError) setFileError(error.field("file") ?? null);
    }
  });

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={document ? "Edit document" : `Upload ${owner} document`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {document ? "Save changes" : "Save document"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={formError} />
        </div>
        <Field label={owner === "vehicle" ? "Vehicle" : "Driver"} htmlFor="owner_id" error={errors.owner_id?.message} required>
          <Select id="owner_id" options={ownerOptions} placeholder="Select…" disabled={!!document} invalid={!!errors.owner_id} {...register("owner_id")} />
        </Field>
        <Field label="Document type" htmlFor="document_type" error={errors.document_type?.message} required>
          <Select id="document_type" options={types} placeholder="Select type" invalid={!!errors.document_type} {...register("document_type")} />
        </Field>
        <Field label="Title" htmlFor="title" error={errors.title?.message} required className="sm:col-span-2">
          <Input id="title" invalid={!!errors.title} {...register("title")} />
        </Field>
        <Field label="Document number" htmlFor="document_number">
          <Input id="document_number" {...register("document_number")} />
        </Field>
        <div />
        <Field label="Issued on" htmlFor="issued_at">
          <Input id="issued_at" type="date" {...register("issued_at")} />
        </Field>
        <Field label="Expires on" htmlFor="expires_at" error={errors.expires_at?.message} hint="Leave empty if it does not expire.">
          <Input id="expires_at" type="date" invalid={!!errors.expires_at} {...register("expires_at")} />
        </Field>
        <Field
          label={document?.has_file ? "Replace file" : "File"}
          htmlFor="file"
          error={fileError ?? undefined}
          hint={document?.original_name ? `Current: ${document.original_name}` : "PDF, image, Word or Excel, up to 10 MB."}
          className="sm:col-span-2"
        >
          <label htmlFor="file" className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-ink-300 px-4 py-3 text-sm text-ink-600 hover:border-brand-600">
            <Paperclip className="h-4 w-4" />
            {file ? `${file.name} (${formatFileSize(file.size)})` : "Choose a file…"}
            <input
              id="file"
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => {
                const chosen = e.target.files?.[0] ?? null;
                setFileError(chosen && chosen.size > MAX_BYTES ? "The file must be 10 MB or smaller." : null);
                setFile(chosen);
              }}
            />
          </label>
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Input id="notes" {...register("notes")} />
        </Field>
      </form>
    </Modal>
  );
}
