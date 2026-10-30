"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import type { Option } from "@/lib/constants";
import { ApiError } from "@/services/api-client";
import { REPORT_TYPE_OPTIONS, REPORT_TYPES, reportsService, type Report, type ReportFilters, type ReportType } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Starts from the page's current filters. */
  initial: ReportFilters & { type?: string };
  vehicleOptions: Option[];
  driverOptions: Option[];
  onCreated: (report: Report) => void;
}

export function GenerateReportModal({ open, onClose, initial, vehicleOptions, driverOptions, onCreated }: Props) {
  const [form, setForm] = useState({ name: "", type: "fleet" as ReportType, from: "", to: "", vehicle_id: "", driver_id: "" });
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Custom reports are configured on Reports → Custom Reports.
    const type = initial.type && initial.type !== "custom" ? (initial.type as ReportType) : "fleet";
    setForm({ name: REPORT_TYPES[type].title, type, from: initial.from, to: initial.to, vehicle_id: initial.vehicle_id ?? "", driver_id: initial.driver_id ?? "" });
    setNameTouched(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = useMutation({
    mutationFn: () =>
      reportsService.create({
        name: form.name.trim(),
        type: form.type,
        from: form.from,
        to: form.to,
        vehicle_id: form.vehicle_id || undefined,
        driver_id: form.driver_id || undefined,
      }),
    onSuccess: (r) => onCreated(r.data),
  });
  const error = create.error instanceof ApiError ? create.error : null;
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={() => {
        create.reset();
        onClose();
      }}
      title="Generate Report"
      description="The report keeps these settings; its figures are computed from live records each time it is opened."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="generate-report" loading={create.isPending}>
            Generate Report
          </Button>
        </>
      }
    >
      <form
        id="generate-report"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <FormError message={error && !Object.keys(error.errors).length ? error.message : null} />
        <Field label="Report Type" htmlFor="report-type" required error={error?.field("type")}>
          <Select
            id="report-type"
            value={form.type}
            options={REPORT_TYPE_OPTIONS.filter((o) => o.value !== "custom")}
            onChange={(e) => {
              const type = e.target.value as ReportType;
              setForm((f) => ({ ...f, type, name: nameTouched ? f.name : REPORT_TYPES[type].title }));
            }}
          />
        </Field>
        <Field label="Report Name" htmlFor="report-name" required error={error?.field("name")}>
          <Input
            id="report-name"
            value={form.name}
            maxLength={120}
            required
            onChange={(e) => {
              setNameTouched(true);
              set("name", e.target.value);
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" htmlFor="report-from" required error={error?.field("from")}>
            <Input id="report-from" type="date" value={form.from} max={form.to || undefined} required onChange={(e) => set("from", e.target.value)} />
          </Field>
          <Field label="To" htmlFor="report-to" required error={error?.field("to")}>
            <Input id="report-to" type="date" value={form.to} min={form.from || undefined} required onChange={(e) => set("to", e.target.value)} />
          </Field>
          <Field label="Vehicle" htmlFor="report-vehicle" error={error?.field("vehicle_id")}>
            <Select id="report-vehicle" value={form.vehicle_id} options={vehicleOptions} placeholder="All Vehicles" onChange={(e) => set("vehicle_id", e.target.value)} />
          </Field>
          <Field label="Driver" htmlFor="report-driver" error={error?.field("driver_id")}>
            <Select id="report-driver" value={form.driver_id} options={driverOptions} placeholder="All Drivers" onChange={(e) => set("driver_id", e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
