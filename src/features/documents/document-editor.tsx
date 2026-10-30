"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, CircleCheck, CloudUpload, Download, Eye, FileText, Info, MoreVertical, Replace, Save, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dropdown, type DropdownItem } from "@/components/ui/dropdown";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/use-current-user";
import { DOCUMENT_GROUPS, DRIVER_DOCUMENT_TYPES, VEHICLE_DOCUMENT_TYPES } from "@/lib/constants";
import { cn, formatFileSize } from "@/lib/utils";
import { documentsService } from "@/services/resources";
import type { DocumentFile, DocumentOwner, FleetDocument } from "@/types/api";
import { vehicleLabel } from "../fuel/fuel-editor";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { applyApiErrors, nullable } from "../shared";

export const DOCUMENTS_PATH = "/fleet/documents";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 20;
const NOTES_LIMIT = 255;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];

const schema = z
  .object({
    owner_type: z.enum(["vehicle", "driver"]),
    owner_id: z.string().min(1, "Select who this document belongs to."),
    group: z.string().min(1, "Select a document type."),
    document_type: z.string().min(1, "Select a document category."),
    title: z.string().trim().min(1, "Document name is required.").max(255),
    document_number: z.string().trim().min(1, "Document number is required.").max(80),
    issued_at: z.string().min(1, "Issue date is required."),
    expires_at: z.string().min(1, "Expiry date is required."),
    issuing_authority: z.string().trim().max(120),
    notes: z.string().max(NOTES_LIMIT, `Up to ${NOTES_LIMIT} characters.`),
  })
  .refine((v) => !v.issued_at || !v.expires_at || v.expires_at >= v.issued_at, { path: ["expires_at"], message: "Expiry must be on or after the issue date." });
type FormValues = z.infer<typeof schema>;
const FIELDS = [...Object.keys(schema.shape), "file"];

const groupOf = (owner: DocumentOwner, category: string) => DOCUMENT_GROUPS[owner].find((g) => g.categories.includes(category))?.value ?? "";

function defaults(d?: FleetDocument, owner: DocumentOwner = "vehicle", ownerId = ""): FormValues {
  const ownerType = d?.owner_type ?? owner;
  return {
    owner_type: ownerType,
    owner_id: d ? String(d.vehicle_id ?? d.driver_id) : ownerId,
    group: d ? groupOf(ownerType, d.document_type) : DOCUMENT_GROUPS[ownerType][0].value,
    document_type: d?.document_type ?? "",
    title: d?.title ?? "",
    document_number: d?.document_number ?? "",
    issued_at: d?.issued_at ?? "",
    expires_at: d?.expires_at ?? "",
    issuing_authority: d?.issuing_authority ?? "",
    notes: d?.notes ?? "",
  };
}

/** A file picked on this page. It counts as uploaded only once the API has answered with the stored file. */
interface PendingFile {
  key: string;
  file: File;
  preview: string | null;
  status: "ready" | "uploading" | "error";
  progress: number;
  error?: string;
}

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const kindLabel = (name: string, mime?: string | null) => (mime === "application/pdf" ? "PDF" : extensionOf(name).toUpperCase().replace("JPEG", "JPG") || "FILE");
const isImage = (name: string, mime?: string | null) => (mime ? mime.startsWith("image/") : ["jpg", "jpeg", "png", "webp"].includes(extensionOf(name)));
let keySeq = 0;

/** `/fleet/documents/upload` and `/fleet/documents/[owner]/[id]/edit` (same layout family as Add Vehicle / Add Fuel Transaction). */
export function DocumentEditor({ owner, documentId, defaultOwnerId }: { owner?: DocumentOwner; documentId?: number; defaultOwnerId?: string }) {
  const { canOperate } = usePermissions();
  const existing = useQuery({
    queryKey: ["documents", owner, documentId, "form"],
    queryFn: () => documentsService.get(owner!, documentId!).then((r) => r.data),
    enabled: !!documentId && !!owner,
  });

  if (!canOperate) return <ErrorState message="You do not have permission to upload or edit documents." />;
  if (documentId) {
    if (existing.isLoading) return <LoadingState label="Loading document…" />;
    if (existing.error || !existing.data) return <ErrorState message={existing.error?.message ?? "Document not found."} onRetry={() => existing.refetch()} />;
    return <DocumentForm key={existing.data.id} document={existing.data} />;
  }
  return <DocumentForm defaultOwner={owner} defaultOwnerId={defaultOwnerId} />;
}

function DocumentForm({ document, defaultOwner, defaultOwnerId }: { document?: FleetDocument; defaultOwner?: DocumentOwner; defaultOwnerId?: string }) {
  const router = useRouter();
  const notify = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<{ kind: "pending"; key: string } | { kind: "stored"; id: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Set once a new document has been created, so a retry after a failed file upload updates it instead of creating another.
  const [savedId, setSavedId] = useState<number | null>(document?.id ?? null);
  const editing = !!document;

  const { vehicles, drivers } = useFleetOptions();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(document, defaultOwner, defaultOwnerId) });
  const values = watch();
  const ownerType = values.owner_type;
  const locked = savedId !== null; // the API does not move a document to another vehicle or driver
  const groups = DOCUMENT_GROUPS[ownerType];
  const allCategories = ownerType === "vehicle" ? VEHICLE_DOCUMENT_TYPES : DRIVER_DOCUMENT_TYPES;
  const categories = allCategories.filter((c) => groups.find((g) => g.value === values.group)?.categories.includes(c.value));

  // A type with a single category picks it.
  useEffect(() => {
    if (categories.length === 1 && values.document_type !== categories[0].value) setValue("document_type", categories[0].value);
  }, [categories, values.document_type, setValue]);

  const chooseOwnerType = (next: DocumentOwner) => {
    if (locked || next === ownerType) return;
    setValue("owner_type", next);
    setValue("owner_id", "");
    setValue("group", DOCUMENT_GROUPS[next][0].value);
    setValue("document_type", "");
  };

  // ----- Files ---------------------------------------------------------------------------
  const [stored, setStored] = useState<DocumentFile[]>(document?.files ?? []);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const visibleStored = stored.filter((f) => !removedIds.includes(f.id));
  const totalFiles = visibleStored.length + pending.length;

  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const makePending = (file: File): PendingFile => {
    const preview = isImage(file.name, file.type) ? URL.createObjectURL(file) : null;
    if (preview) previews.current.add(preview);
    return { key: `f${++keySeq}`, file, preview, status: "ready", progress: 0 };
  };
  const dropPreview = (p: PendingFile) => {
    if (p.preview) {
      URL.revokeObjectURL(p.preview);
      previews.current.delete(p.preview);
    }
  };

  const addFiles = (list: FileList | File[]) => {
    const target = replacing.current;
    replacing.current = null;
    const rejected: string[] = [];
    const accepted = Array.from(list).filter((f) => {
      if (!ALLOWED_EXTENSIONS.includes(extensionOf(f.name))) rejected.push(`${f.name} is not a PDF, JPG or PNG.`);
      else if (f.size > MAX_FILE_BYTES) rejected.push(`${f.name} is larger than 10 MB.`);
      else return true;
      return false;
    });
    if (target) {
      const file = accepted[0];
      if (file) {
        if (target.kind === "stored") {
          setRemovedIds((ids) => [...ids, target.id]);
          setPending((list) => [...list, makePending(file)]);
        } else {
          setPending((list) =>
            list.map((p) => {
              if (p.key !== target.key) return p;
              dropPreview(p);
              return makePending(file);
            }),
          );
        }
      }
    } else {
      const room = MAX_FILES - totalFiles;
      if (accepted.length > room) rejected.push(`A document can have up to ${MAX_FILES} files; ${accepted.length - Math.max(room, 0)} were not added.`);
      setPending((list) => [...list, ...accepted.slice(0, Math.max(room, 0)).map(makePending)]);
    }
    if (rejected.length) notify(rejected.join(" "), "error");
  };

  const removePending = (key: string) =>
    setPending((list) =>
      list.filter((p) => {
        if (p.key === key) dropPreview(p);
        return p.key !== key;
      }),
    );
  const patchPending = (key: string, patch: Partial<PendingFile>) => setPending((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const pick = (target: typeof replacing.current = null) => {
    replacing.current = target;
    fileInput.current?.click();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!saving && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  // ----- Save: details first, then each file on its own so every file is confirmed by the API ----
  const submit = handleSubmit(
    async (v) => {
      setFormError(null);
      if (totalFiles === 0) return setFormError("Add at least one file to upload.");
      setSaving(true);
      let id = savedId;
      try {
        // "group" (Document Type) is only a UI grouping of categories.
        const payload = nullable({
          document_type: v.document_type,
          title: v.title,
          document_number: v.document_number,
          issued_at: v.issued_at,
          expires_at: v.expires_at,
          issuing_authority: v.issuing_authority,
          notes: v.notes,
        });
        if (id) {
          await documentsService.update(v.owner_type, id, payload);
        } else {
          const created = await documentsService.create({ ...payload, owner_type: v.owner_type, owner_id: Number(v.owner_id) });
          id = created.data.id;
          setSavedId(id);
        }
      } catch (error) {
        setFormError(applyApiErrors(error, setError as UseFormSetError<FormValues>, FIELDS));
        setSaving(false);
        return;
      }

      let failed = 0;
      for (const p of pending) {
        patchPending(p.key, { status: "uploading", progress: 0, error: undefined });
        try {
          const result = await documentsService.addFile(v.owner_type, id, p.file, (progress) => patchPending(p.key, { progress }));
          setStored((list) => [...list, result.data]);
          removePending(p.key);
        } catch (error) {
          failed++;
          patchPending(p.key, { status: "error", progress: 0, error: error instanceof Error ? error.message : "Upload failed." });
        }
      }
      for (const fileId of removedIds) {
        try {
          await documentsService.removeFile(v.owner_type, id, fileId);
          setStored((list) => list.filter((f) => f.id !== fileId));
          setRemovedIds((ids) => ids.filter((x) => x !== fileId));
        } catch {
          failed++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring"] });
      setSaving(false);
      if (failed) {
        setFormError(
          `The document details were saved, but ${failed} file change${failed === 1 ? "" : "s"} did not go through. Retry or remove the files marked below, then click ${editing ? "Save Changes" : "Upload Document"} again.`,
        );
        return;
      }
      notify(editing ? "Document updated." : "Document uploaded.");
      router.push(`${DOCUMENTS_PATH}?owner=${v.owner_type}`);
    },
    () => setFormError("Some details are missing or invalid. Check the highlighted fields."),
  );

  const title = editing ? "Edit Document" : "Upload Document";
  const uploadedCount = visibleStored.length;

  return (
    <form onSubmit={submit} noValidate>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">
            {editing ? "Update this document's details and files." : "Upload vehicle or driver document, license, or certification."}
          </p>
        </div>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-ink-500">
          <span>Fleet &amp; Drivers</span>
          <ChevronRight className="h-4 w-4" />
          <Link href={DOCUMENTS_PATH} className="hover:text-ink-900">
            Documents
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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* Document information */}
        <Card>
          <CardHeader title="Document Information" icon={<FileText />} />
          <CardBody className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <Field label="Document Name" htmlFor="title" error={errors.title?.message} required>
              <Input id="title" placeholder="e.g. Certificate of Registration" invalid={!!errors.title} {...register("title")} />
            </Field>
            <Field label="Document Type" htmlFor="group" error={errors.group?.message} required>
              <Select
                id="group"
                options={groups.map((g) => ({ value: g.value, label: g.label }))}
                placeholder="Select document type"
                invalid={!!errors.group}
                {...register("group", { onChange: () => setValue("document_type", "") })}
              />
            </Field>

            <fieldset className="space-y-1.5">
              <legend className="mb-1.5 block text-sm font-medium text-ink-800">
                Related To<span className="ml-0.5 text-brand-600">*</span>
              </legend>
              <div className="flex h-10 items-center gap-6">
                {(["vehicle", "driver"] as const).map((o) => (
                  <label key={o} className={cn("flex items-center gap-2 text-sm text-ink-800", locked ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
                    <input
                      type="radio"
                      name="owner_type"
                      value={o}
                      checked={ownerType === o}
                      disabled={locked && ownerType !== o}
                      onChange={() => chooseOwnerType(o)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    {o === "vehicle" ? "Vehicle" : "Driver"}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label={ownerType === "vehicle" ? "Vehicle" : "Driver"} htmlFor="owner_id" error={errors.owner_id?.message} required>
              {/* Remounts once the options load (or the owner type changes) so the saved owner is selected. */}
              <Select
                key={`${ownerType}-${ownerType === "vehicle" ? vehicles.length : drivers.length}`}
                id="owner_id"
                options={
                  ownerType === "vehicle"
                    ? vehicles.map((v) => ({ value: String(v.id), label: vehicleLabel(v) }))
                    : drivers.map((d) => ({ value: String(d.id), label: `${d.full_name} - ${d.license_number}` }))
                }
                placeholder={ownerType === "vehicle" ? "Select vehicle" : "Select driver"}
                disabled={locked}
                invalid={!!errors.owner_id}
                {...register("owner_id")}
              />
            </Field>

            <Field label="Document Category" htmlFor="document_type" error={errors.document_type?.message} required>
              <Select
                key={values.group}
                id="document_type"
                options={categories}
                placeholder="Select category"
                invalid={!!errors.document_type}
                {...register("document_type")}
              />
            </Field>
            <Field label="Document Number" htmlFor="document_number" error={errors.document_number?.message} required>
              <Input id="document_number" placeholder="e.g. CR-2023-00123" invalid={!!errors.document_number} {...register("document_number")} />
            </Field>

            <Field label="Issue Date" htmlFor="issued_at" error={errors.issued_at?.message} required>
              <Input id="issued_at" type="date" invalid={!!errors.issued_at} {...register("issued_at")} />
            </Field>
            <Field label="Expiry Date" htmlFor="expires_at" error={errors.expires_at?.message} required>
              <Input id="expires_at" type="date" min={values.issued_at || undefined} invalid={!!errors.expires_at} {...register("expires_at")} />
            </Field>

            <Field label="Issuing Authority" htmlFor="issuing_authority" error={errors.issuing_authority?.message}>
              <Input id="issuing_authority" placeholder="e.g. LTO" invalid={!!errors.issuing_authority} {...register("issuing_authority")} />
            </Field>

            <Field label="Remarks" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
              <Textarea id="notes" rows={4} maxLength={NOTES_LIMIT} placeholder="Anything worth noting about this document" invalid={!!errors.notes} {...register("notes")} />
              <p className="mt-1 text-right text-xs text-ink-500">
                {values.notes.length}/{NOTES_LIMIT}
              </p>
            </Field>
          </CardBody>
        </Card>

        {/* Files */}
        <Card>
          <CardHeader title="Upload Files" icon={<CloudUpload />} />
          <CardBody className="space-y-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
                dragging ? "border-brand-500 bg-brand-50" : "border-ink-200 bg-ink-50/50",
              )}
            >
              <CloudUpload className="h-12 w-12 text-brand-600" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-ink-800">Drag and drop files here</p>
              <p className="my-2 text-xs text-ink-500">or</p>
              <Button variant="secondary" size="sm" onClick={() => pick()} disabled={saving || totalFiles >= MAX_FILES} className="border-brand-600 text-brand-600 hover:bg-brand-50">
                Browse Files
              </Button>
              <p className="mt-3 text-xs text-ink-500">Supported formats: PDF, JPG, PNG (Max 10MB per file)</p>
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                else replacing.current = null;
                e.target.value = "";
              }}
            />

            <div>
              <h3 className="text-sm font-semibold text-ink-900">
                Uploaded Files ({uploadedCount})
                {pending.length > 0 && <span className="ml-1 font-normal text-ink-500">· {pending.length} waiting to upload</span>}
              </h3>
              {totalFiles === 0 ? (
                <p className="mt-2 rounded-lg border border-ink-100 px-4 py-5 text-center text-sm text-ink-500">No files yet. Add at least one file.</p>
              ) : (
                <ul className="mt-2 divide-y divide-ink-100 rounded-lg border border-ink-100">
                  {visibleStored.map((f) => (
                    <FileRow
                      key={`s${f.id}`}
                      name={f.original_name}
                      meta={`${formatFileSize(f.file_size)} • ${kindLabel(f.original_name, f.mime_type)}`}
                      thumbnail={isImage(f.original_name, f.mime_type) ? documentsService.fileUrl(f) : null}
                      state={{ status: "uploaded" }}
                      actions={[
                        { label: "View", icon: <Eye />, onSelect: () => window.open(documentsService.fileUrl(f), "_blank", "noopener") },
                        { label: "Download", icon: <Download />, onSelect: () => window.location.assign(documentsService.fileUrl(f, true)) },
                        { label: "Replace", icon: <Replace />, onSelect: () => pick({ kind: "stored", id: f.id }), disabled: saving },
                        { label: "Remove", icon: <Trash2 />, danger: true, onSelect: () => setRemovedIds((ids) => [...ids, f.id]), disabled: saving },
                      ]}
                    />
                  ))}
                  {pending.map((p) => (
                    <FileRow
                      key={p.key}
                      name={p.file.name}
                      meta={`${formatFileSize(p.file.size)} • ${kindLabel(p.file.name, p.file.type)}`}
                      thumbnail={p.preview}
                      state={p}
                      actions={[
                        { label: "Replace", icon: <Replace />, onSelect: () => pick({ kind: "pending", key: p.key }), disabled: saving },
                        { label: "Remove", icon: <Trash2 />, danger: true, onSelect: () => removePending(p.key), disabled: saving },
                      ]}
                    />
                  ))}
                </ul>
              )}
              {removedIds.length > 0 && (
                <p className="mt-2 text-xs text-ink-500">
                  {removedIds.length} file{removedIds.length === 1 ? "" : "s"} will be removed when you save.{" "}
                  <button type="button" onClick={() => setRemovedIds([])} className="font-medium text-brand-600 hover:text-brand-700">
                    Undo
                  </button>
                </p>
              )}
            </div>

            <div className="flex gap-3 rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <p>
                You can upload multiple files for the same document.
                <br />
                Accepted file types: PDF, JPG, PNG.
                <br />
                Maximum file size: 10MB per file.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" onClick={() => router.push(DOCUMENTS_PATH)} disabled={saving} className="min-w-32">
          Cancel
        </Button>
        <Button type="submit" size="lg" loading={saving} className="min-w-48">
          {editing ? <Save className="h-4 w-4" /> : <Upload className="h-4 w-4" />} {editing ? "Save Changes" : "Upload Document"}
        </Button>
      </div>
    </form>
  );
}

type RowState = { status: "uploaded" } | Pick<PendingFile, "status" | "progress" | "error">;

function FileRow({ name, meta, thumbnail, state, actions }: { name: string; meta: string; thumbnail: string | null; state: RowState; actions: DropdownItem[] }) {
  const pdf = extensionOf(name) === "pdf";
  const percent = state.status === "uploaded" ? 100 : state.status === "uploading" ? Math.round(state.progress * 100) : 0;

  return (
    <li className="flex items-center gap-3 px-3 py-3">
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- local preview or served by the API
        <img src={thumbnail} alt="" className="h-11 w-11 shrink-0 rounded-md border border-ink-100 object-cover" />
      ) : (
        <span className={cn("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md text-[10px] font-bold", pdf ? "bg-brand-50 text-brand-600" : "bg-ink-100 text-ink-600")}>
          <FileText className="h-5 w-5" />
          {pdf ? "PDF" : extensionOf(name).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
          <span className="truncate" title={name}>
            {name}
          </span>
          {state.status === "uploaded" && <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Uploaded" />}
        </p>
        <p className="text-xs text-ink-500">
          {meta}
          {state.status === "ready" && " • Uploads when you save"}
          {state.status === "uploading" && ` • Uploading ${percent}%`}
        </p>
        {state.status === "error" ? (
          <p className="mt-1 text-xs font-medium text-brand-700" role="alert">
            Not uploaded: {state.error}
          </p>
        ) : (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div className={cn("h-full rounded-full transition-[width]", state.status === "uploaded" ? "bg-emerald-500" : "bg-brand-600")} style={{ width: `${percent}%` }} />
            </div>
            {state.status === "uploaded" && <span className="text-xs text-ink-500 tabular-nums">100%</span>}
          </div>
        )}
      </div>
      <Dropdown
        trigger={({ toggle }) => (
          <button type="button" onClick={toggle} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Actions for ${name}`}>
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
        items={actions}
      />
    </li>
  );
}
