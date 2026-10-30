"use client";

import { ArrowRightLeft, Clock, LogIn, LogOut, MapPinned } from "lucide-react";
import { useRef } from "react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Field, Select } from "@/components/ui/form";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { ReportConfigPanel, ReportHeader, ReportLayout, TABLE_CELL, TableCard, focusPanel, monthPeriod, useReportConfig } from "./report-page";
import { Stat } from "./report-widgets";

const PAGE_PATH = "/reports/geofences";

const NO_DATA = { value: null, previous: null };

/**
 * Reports → Geofence Reports. BlitzMove stores GPS pings (vehicle_locations) but no geofence definitions, so there
 * are no entry/exit events to report. The page shows the report's layout with an explanation instead of figures.
 */
export function GeofenceReportView() {
  const panelRef = useRef<HTMLDivElement>(null);
  const { vehicleOptions, driverOptions } = useFleetOptions();
  const config = useReportConfig(() => ({ ...monthPeriod(), vehicle_id: "", driver_id: "" }), ["geofences"]);
  const { draft } = config;

  const columns = ["#", "Vehicle", "Driver", "Geofence", "Event", "Entry Time", "Exit Time", "Duration Inside"].map((header) => ({
    key: header,
    header,
    cell: () => null,
    className: TABLE_CELL,
    headerClassName: "px-3",
  }));

  return (
    <div>
      <ReportHeader title="Geofence Report" subtitle="Vehicle entries, exits and time spent inside your geofenced locations." crumb="Geofence Reports" path={PAGE_PATH} />

      <ReportLayout
        config={
          <ReportConfigPanel panelRef={panelRef} period={draft} onPeriodChange={config.setPeriod} onReset={config.reset} onGenerate={config.generate} disabled>
            <Field label="Geofence" htmlFor="gf-geofence" hint="No geofences have been set up.">
              <Select id="gf-geofence" value="" onChange={() => undefined} options={[]} placeholder="All Geofences" disabled />
            </Field>
            <Field label="Vehicle" htmlFor="gf-vehicle">
              <Select id="gf-vehicle" value={draft.vehicle_id} onChange={(e) => config.set("vehicle_id", e.target.value)} options={vehicleOptions} placeholder="All Vehicles" disabled />
            </Field>
            <Field label="Driver" htmlFor="gf-driver">
              <Select id="gf-driver" value={draft.driver_id} onChange={(e) => config.set("driver_id", e.target.value)} options={driverOptions} placeholder="All Drivers" disabled />
            </Field>
          </ReportConfigPanel>
        }
      >
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <MapPinned className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 text-sm text-ink-600">
            <h2 className="text-base font-semibold text-ink-900">Geofences aren&apos;t set up yet</h2>
            <p className="mt-1">
              This report lists when vehicles enter and leave geofenced areas. BlitzMove records vehicle GPS positions, but it doesn&apos;t have any geofences to compare them
              with yet, so there are no entry or exit events to show.
            </p>
            <p className="mt-2">Once geofences can be defined (name and area), entries, exits and time inside will be worked out from the GPS positions and shown here.</p>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <Stat icon={LogIn} tone="bg-emerald-50 text-emerald-600" label="Entries" stat={NO_DATA} format={String} />
          <Stat icon={LogOut} tone="bg-orange-50 text-orange-500" label="Exits" stat={NO_DATA} format={String} />
          <Stat icon={ArrowRightLeft} tone="bg-blue-50 text-blue-600" label="Vehicles in Geofences" stat={NO_DATA} format={String} />
          <Stat icon={Clock} tone="bg-violet-50 text-violet-600" label="Avg. Time Inside" stat={NO_DATA} format={String} />
        </div>

        <TableCard icon={<MapPinned />} title="Geofence Events" filterCount={0} onFilter={() => focusPanel(panelRef)} exportItems={[{ label: "Events (Excel CSV)", onSelect: () => undefined, disabled: true }]}>
          <DataTable
            columns={columns}
            rows={[]}
            rowKey={() => 0}
            empty={{ title: "No geofence events", description: "Geofence entries and exits will appear here once geofences are set up." }}
          />
        </TableCard>
      </ReportLayout>
    </div>
  );
}
