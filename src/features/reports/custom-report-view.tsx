"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, ClipboardList, Columns3, FileSpreadsheet, FolderOpen, Table2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser, usePermissions } from "@/hooks/use-current-user";
import { exportCsv, fetchAllPages } from "@/lib/export";
import { cn, formatDate } from "@/lib/utils";
import { ApiError } from "@/services/api-client";
import type { ListParams } from "@/types/api";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { CUSTOM_REPORTS_PATH, reportsService, type CustomSource, type Report } from "./api";
import { CUSTOM_SOURCE_OPTIONS, CUSTOM_SOURCES, presetColumns, type CustomField } from "./custom-report-sources";
import { ConfigHeading, ReportConfigPanel, ReportHeader, ReportLayout, TABLE_CELL, TableCard, focusPanel, monthPeriod, useReportConfig } from "./report-page";
import { IconButton } from "./report-widgets";

interface Config {
  from: string;
  to: string;
  source: CustomSource;
  columns: string[];
  sort: string;
  vehicle_id: string;
  driver_id: string;
  status: string;
}

const sourceDefaults = (source: CustomSource) => ({ source, columns: presetColumns(source), sort: CUSTOM_SOURCES[source].defaultSort, status: "" });
const defaults = (): Config => ({ ...monthPeriod(), ...sourceDefaults("trips"), vehicle_id: "", driver_id: "" });

/** A saved report back into builder settings, ignoring columns the source no longer has. */
function fromSaved(report: Report): Config | null {
  const c = report.config;
  if (!c || !CUSTOM_SOURCES[c.source]) return null;
  const def = CUSTOM_SOURCES[c.source];
  const columns = c.columns.filter((key) => def.fields.some((f) => f.key === key));
  return {
    from: report.period_from,
    to: report.period_to,
    source: c.source,
    columns: columns.length ? columns : presetColumns(c.source),
    sort: c.sort || def.defaultSort,
    vehicle_id: def.vehicle && report.vehicle_id ? String(report.vehicle_id) : "",
    driver_id: def.driver && report.driver_id ? String(report.driver_id) : "",
    status: c.filters?.status ?? "",
  };
}

export function CustomReportView() {
  const notify = useToast();
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const { canOperate } = usePermissions();
  const panelRef = useRef<HTMLDivElement>(null);
  const { vehicleOptions, driverOptions } = useFleetOptions();
  const config = useReportConfig(defaults, ["reports", "custom-preview"]);
  const { draft, applied } = config;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Report | null>(null);
  const [loadedId, setLoadedId] = useState<number | null>(null);

  const draftDef = CUSTOM_SOURCES[draft.source];
  const def = CUSTOM_SOURCES[applied.source];

  // Query params for the source's list endpoint.
  const filters = useMemo(() => {
    const d = CUSTOM_SOURCES[applied.source];
    const params: ListParams = {};
    if (d.period) Object.assign(params, { [d.period.from]: applied.from, [d.period.to]: applied.to });
    if (d.vehicle && applied.vehicle_id) params.vehicle_id = applied.vehicle_id;
    if (d.driver && applied.driver_id) params.driver_id = applied.driver_id;
    if (d.status && applied.status) params.status = applied.status;
    return params;
  }, [applied]);
  const listParams: ListParams = { ...filters, search: search || undefined, sort: applied.sort, page, per_page: perPage };
  const preview = useQuery({
    queryKey: ["reports", "custom-preview", applied.source, listParams],
    queryFn: () => def.load(listParams),
    placeholderData: keepPreviousData,
    enabled: config.ready && applied.columns.length > 0,
  });
  const saved = useQuery({ queryKey: ["reports", "list", { type: "custom" }], queryFn: () => reportsService.list({ type: "custom", per_page: 50 }) });

  // Opened from the Report List (?report=ID): load that saved configuration once.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("report"));
    if (!id) return;
    reportsService
      .get(id)
      .then(({ data }) => {
        const next = fromSaved(data);
        if (!next) return notify("That report has no custom configuration to open.", "error");
        config.load(next);
        setLoadedId(data.id);
      })
      .catch((e: Error) => notify(e.message, "error"));
    window.history.replaceState(null, "", CUSTOM_REPORTS_PATH);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useMutation({
    mutationFn: (report: Report) => reportsService.remove(report.id),
    onSuccess: (_, report) => {
      notify("Report deleted.");
      setDeleting(null);
      if (loadedId === report.id) setLoadedId(null);
      queryClient.invalidateQueries({ queryKey: ["reports", "list"] });
    },
  });

  const chooseSource = (source: CustomSource) => {
    const next = CUSTOM_SOURCES[source];
    config.load({ ...draft, ...sourceDefaults(source), vehicle_id: next.vehicle ? draft.vehicle_id : "", driver_id: next.driver ? draft.driver_id : "" });
    setSearch("");
    setPage(1);
    setLoadedId(null);
  };
  const toggleColumn = (key: string) =>
    config.set(
      "columns",
      draft.columns.includes(key) ? draft.columns.filter((k) => k !== key) : draftDef.fields.map((f) => f.key).filter((k) => k === key || draft.columns.includes(k)),
    );

  const fields = applied.columns.map((key) => def.fields.find((f) => f.key === key)).filter(Boolean) as CustomField<unknown>[];
  const rows = preview.data?.data;
  const filterCount = [def.vehicle && applied.vehicle_id, def.driver && applied.driver_id, def.status && applied.status].filter(Boolean).length;
  const sortOptions = draftDef.fields.filter((f) => f.sortKey).flatMap((f) => [
    { value: f.sortKey!, label: `${f.label} (ascending)` },
    { value: `-${f.sortKey}`, label: `${f.label} (descending)` },
  ]);

  const columns: Column<unknown>[] = fields.map((f) => ({
    key: f.key,
    header: f.label,
    sortKey: f.sortKey,
    className: cn(TABLE_CELL, "whitespace-nowrap"),
    headerClassName: "px-3",
    cell: (row) => (f.render ? f.render(row) : (f.value(row) ?? "—") === "" ? "—" : (f.value(row) ?? "—")),
  }));

  const exportRows = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages(def.load, { ...filters, search: search || undefined, sort: applied.sort });
      exportCsv(
        `custom-${applied.source}`,
        fields.map((f) => f.label),
        all.map((row) => fields.map((f) => f.value(row))),
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <ReportHeader title="Custom Report" subtitle="Pick a data source, the columns you need and filters, then preview, export or save the report." crumb="Custom Reports" path={CUSTOM_REPORTS_PATH} />

      <ReportLayout
        config={
          <ReportConfigPanel
            panelRef={panelRef}
            period={draft}
            onPeriodChange={config.setPeriod}
            periodDisabled={!draftDef.period}
            periodHint={draftDef.period?.label ?? "Drivers and vehicles are listed as they are now."}
            onReset={() => {
              config.reset();
              setSearch("");
              setPage(1);
              setLoadedId(null);
            }}
            onGenerate={() => {
              if (!draft.columns.length) return notify("Select at least one column.", "error");
              config.generate();
              setPage(1);
            }}
            generateLabel="Generate Preview"
            loading={preview.isFetching && !preview.isLoading}
            dirty={config.dirty}
          >
            <Field label="Data Source" htmlFor="cr-source" required hint={draftDef.description} className="sm:col-span-2 lg:col-span-1 xl:order-first">
              <Select id="cr-source" value={draft.source} onChange={(e) => chooseSource(e.target.value as CustomSource)} options={CUSTOM_SOURCE_OPTIONS} />
            </Field>
            {draftDef.vehicle && (
              <Field label="Vehicle" htmlFor="cr-vehicle">
                <Select id="cr-vehicle" value={draft.vehicle_id} onChange={(e) => config.set("vehicle_id", e.target.value)} options={vehicleOptions} placeholder="All Vehicles" />
              </Field>
            )}
            {draftDef.driver && (
              <Field label="Driver" htmlFor="cr-driver">
                <Select id="cr-driver" value={draft.driver_id} onChange={(e) => config.set("driver_id", e.target.value)} options={driverOptions} placeholder="All Drivers" />
              </Field>
            )}
            {draftDef.status && (
              <Field label={draftDef.status.label} htmlFor="cr-status">
                <Select id="cr-status" value={draft.status} onChange={(e) => config.set("status", e.target.value)} options={draftDef.status.options} placeholder="All Statuses" />
              </Field>
            )}
            <Field label="Sort By" htmlFor="cr-sort">
              <Select id="cr-sort" value={draft.sort} onChange={(e) => config.set("sort", e.target.value)} options={sortOptions} />
            </Field>

            <ConfigHeading>Columns</ConfigHeading>
            <fieldset className="sm:col-span-2 lg:col-span-4 xl:col-span-1">
              <legend className="sr-only">Columns</legend>
              <div className="mb-2 flex flex-wrap gap-x-3 text-xs">
                <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => config.set("columns", draftDef.fields.map((f) => f.key))}>
                  Select all
                </button>
                <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => config.set("columns", presetColumns(draft.source))}>
                  Default
                </button>
                <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => config.set("columns", [])}>
                  Clear
                </button>
                <span className="ml-auto text-ink-500">
                  {draft.columns.length} of {draftDef.fields.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-1">
                {draftDef.fields.map((f) => (
                  <Checkbox key={f.key} label={f.label} checked={draft.columns.includes(f.key)} onChange={() => toggleColumn(f.key)} />
                ))}
              </div>
              {!draft.columns.length && <p className="mt-2 text-xs text-brand-600">Select at least one column.</p>}
            </fieldset>
          </ReportConfigPanel>
        }
      >
        <TableCard
          icon={<Table2 />}
          title={`Preview: ${def.label}`}
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder={`Search ${def.noun}...`}
          filterCount={filterCount}
          onFilter={() => focusPanel(panelRef)}
          exporting={exporting}
          exportItems={[{ label: "Report (Excel CSV)", icon: <FileSpreadsheet />, disabled: !preview.data?.meta.total || !fields.length, onSelect: exportRows }]}
          actions={
            <Button onClick={() => setSaving(true)} disabled={!fields.length} title="Save these settings to open the report again later">
              <BookmarkPlus className="h-4 w-4" /> Save Report
            </Button>
          }
        >
          {fields.length ? (
            <>
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(row) => (row as { id: number }).id}
                loading={preview.isFetching}
                error={preview.error}
                onRetry={() => preview.refetch()}
                sort={applied.sort}
                onSortChange={(next) => {
                  config.patch({ sort: next });
                  setPage(1);
                }}
                empty={
                  search || filterCount
                    ? { title: `No ${def.noun} match`, description: "Try a different search, or change the filters in Report Configuration." }
                    : { title: `No ${def.noun} found`, description: def.period ? "Nothing in the selected period." : undefined }
                }
              />
              <Pagination
                meta={preview.data?.meta}
                onPageChange={setPage}
                perPage={perPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
                noun={def.noun}
                showEdges
              />
            </>
          ) : (
            <EmptyState icon={<Columns3 className="h-6 w-6" />} title="No columns selected" description="Choose the columns to include, then select Generate Preview." />
          )}
        </TableCard>

        <Card className="min-w-0 print:hidden">
          <CardHeader icon={<ClipboardList />} title="Saved Custom Reports" description="Saved settings; the data is read live each time a report is opened." />
          {saved.isLoading ? (
            <LoadingState />
          ) : saved.error ? (
            <ErrorState message={saved.error.message} onRetry={() => saved.refetch()} />
          ) : saved.data?.data.length ? (
            <ul className="divide-y divide-ink-100">
              {saved.data.data.map((r) => (
                <li key={r.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm", loadedId === r.id && "bg-brand-50/50")}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-900">{r.name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {r.config ? CUSTOM_SOURCES[r.config.source]?.label : "Unknown source"} · {r.config?.columns.length ?? 0} columns
                      {r.config && CUSTOM_SOURCES[r.config.source]?.period ? ` · ${formatDate(r.period_from)} – ${formatDate(r.period_to)}` : ""}
                      {r.generated_by ? ` · by ${r.generated_by.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      className="h-8 px-3 text-xs"
                      disabled={!fromSaved(r)}
                      onClick={() => {
                        const next = fromSaved(r);
                        if (!next) return;
                        config.load(next);
                        setSearch("");
                        setPage(1);
                        setLoadedId(r.id);
                      }}
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Open
                    </Button>
                    {(canOperate || r.generated_by?.id === user.id) && (
                      <IconButton label="Delete saved report" onClick={() => setDeleting(r)}>
                        <Trash2 className="h-4 w-4 text-brand-600" />
                      </IconButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No saved custom reports" description="Build a report and select Save Report to keep its settings." />
          )}
        </Card>
      </ReportLayout>

      <SaveReportModal
        open={saving}
        onClose={() => setSaving(false)}
        config={applied}
        onSaved={(report) => {
          setSaving(false);
          setLoadedId(report.id);
          notify("Report saved.");
          queryClient.invalidateQueries({ queryKey: ["reports", "list"] });
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete saved report"
        message={`Delete "${deleting?.name ?? ""}"? The data it reads is not affected.`}
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => {
          remove.reset();
          setDeleting(null);
        }}
      />
    </div>
  );
}

function SaveReportModal({ open, onClose, config, onSaved }: { open: boolean; onClose: () => void; config: Config; onSaved: (report: Report) => void }) {
  const [name, setName] = useState("");
  const def = CUSTOM_SOURCES[config.source];

  useEffect(() => {
    if (open) setName(`${def.label} Report`);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () =>
      reportsService.create({
        name: name.trim(),
        type: "custom",
        from: config.from,
        to: config.to,
        vehicle_id: def.vehicle ? config.vehicle_id || undefined : undefined,
        driver_id: def.driver ? config.driver_id || undefined : undefined,
        config: { source: config.source, columns: config.columns, sort: config.sort, filters: def.status && config.status ? { status: config.status } : null },
      }),
    onSuccess: (r) => onSaved(r.data),
  });
  const error = save.error instanceof ApiError ? save.error : null;
  const close = () => {
    save.reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Save Custom Report"
      description="Saves the applied source, columns, sorting, filters and period. It appears in the Report List on Reports → Overview too."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="save-custom-report" loading={save.isPending} disabled={!name.trim()}>
            Save Report
          </Button>
        </>
      }
    >
      <form
        id="save-custom-report"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <FormError message={error && !Object.keys(error.errors).length ? error.message : null} />
        <Field label="Report Name" htmlFor="custom-report-name" required error={error?.field("name") ?? error?.field("config")}>
          <Input id="custom-report-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <p className="text-sm text-ink-500">
          {def.label} · {config.columns.length} columns{def.period ? ` · ${formatDate(config.from)} – ${formatDate(config.to)}` : ""}
        </p>
      </form>
    </Modal>
  );
}
