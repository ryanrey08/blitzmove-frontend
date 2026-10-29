"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileUp, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { downloadFile, parseCsv, toCsv } from "@/lib/csv";
import { ApiError } from "@/services/api-client";
import { ordersService } from "@/services/resources";

/** CSV columns, matching the fields of POST /orders. */
const COLUMNS = [
  "customer_name",
  "customer_contact",
  "pickup_address",
  "delivery_address",
  "scheduled_pickup_at",
  "scheduled_delivery_at",
  "cargo_description",
  "quantity",
  "weight_kg",
  "amount",
  "payment_terms",
  "delivery_instructions",
] as const;
const REQUIRED = COLUMNS.slice(0, 8);

type Row = Record<(typeof COLUMNS)[number], string>;
type Result = { line: number; ok: boolean; message: string };

function templateCsv() {
  return toCsv([
    [...COLUMNS],
    ["Mega Plastics", "0917 555 1234", "123 Industrial Ave, Tanauan, Batangas", "456 Logistics St, Quezon City", "2026-11-03 08:00", "2026-11-03 14:00", "Plastic drums", 20, 4000, 15200, "Net 30", "Call before arrival"],
  ]);
}

/** Creates orders from a CSV file, one row at a time through the regular create-order API (same validation). */
export function OrderImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<{ line: number; row: Row }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);

  const reset = () => {
    setFileName(null);
    setRows([]);
    setError(null);
    setResults([]);
  };
  const close = () => {
    if (running) return;
    reset();
    onClose();
  };

  const load = async (file: File) => {
    reset();
    setFileName(file.name);
    const table = parseCsv(await file.text());
    if (table.length < 2) return setError("The file has no order rows. Use the template's header row and add one order per line.");
    const header = table[0].map((h) => h.trim().toLowerCase());
    const missing = REQUIRED.filter((c) => !header.includes(c));
    if (missing.length) return setError(`Missing required columns: ${missing.join(", ")}.`);
    setRows(
      table.slice(1).map((cells, i) => ({
        line: i + 2,
        row: Object.fromEntries(COLUMNS.map((c) => [c, (cells[header.indexOf(c)] ?? "").trim()])) as Row,
      })),
    );
  };

  const run = async () => {
    setRunning(true);
    const done: Result[] = [];
    for (const { line, row } of rows) {
      try {
        const date = (v: string) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toISOString() : v);
        const result = await ordersService.create({
          ...Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === "" ? null : v])),
          scheduled_pickup_at: date(row.scheduled_pickup_at),
          scheduled_delivery_at: date(row.scheduled_delivery_at),
        });
        done.push({ line, ok: true, message: result.data.order_number });
      } catch (e) {
        const message = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : "Could not create this order.";
        done.push({ line, ok: false, message });
      }
      setResults([...done]);
    }
    setRunning(false);
    const created = done.filter((r) => r.ok).length;
    if (created) {
      ["orders", "dashboard"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      notify(`Imported ${created} order${created === 1 ? "" : "s"}${created < done.length ? `; ${done.length - created} failed` : ""}.`, created < done.length ? "error" : "success");
    }
  };

  const finished = results.length > 0 && !running;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import Orders"
      description="Upload a CSV file. Each row is checked and created like an order entered by hand."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={running}>
            {finished ? "Close" : "Cancel"}
          </Button>
          {!finished && (
            <Button onClick={run} loading={running} disabled={rows.length === 0 || !!error}>
              Import {rows.length || ""} {rows.length === 1 ? "order" : "orders"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-50 px-4 py-3">
          <p className="text-ink-600">
            Required columns: <span className="font-medium text-ink-800">{REQUIRED.join(", ")}</span>. Dates as <code>YYYY-MM-DD HH:mm</code>.
          </p>
          <Button variant="secondary" size="sm" onClick={() => downloadFile("blitzmove-orders-template.csv", templateCsv())}>
            <Download className="h-3.5 w-3.5" /> Template
          </Button>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink-200 px-6 py-8 text-center hover:border-brand-300 hover:bg-brand-50/40">
          <FileUp className="h-7 w-7 text-ink-400" />
          <span className="font-medium text-ink-800">{fileName ?? "Choose a CSV file"}</span>
          <span className="text-xs text-ink-500">{rows.length ? `${rows.length} order row${rows.length === 1 ? "" : "s"} found` : ".csv, up to a few hundred rows"}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={running}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) load(file);
              e.target.value = "";
            }}
          />
        </label>

        <FormError message={error} />

        {results.length > 0 && (
          <ul className="max-h-60 divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-100">
            {results.map((r) => (
              <li key={r.line} className="flex items-start gap-2 px-3 py-2">
                {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />}
                <span className="text-ink-500">Row {r.line}:</span>
                <span className={r.ok ? "text-ink-800" : "text-brand-700"}>{r.ok ? `Created ${r.message}` : r.message}</span>
              </li>
            ))}
          </ul>
        )}
        {running && <p className="text-xs text-ink-500">Importing {results.length + 1} of {rows.length}…</p>}
      </div>
    </Modal>
  );
}
