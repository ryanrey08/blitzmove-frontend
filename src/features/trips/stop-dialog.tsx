"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/utils";
import { stopsService } from "@/services/resources";
import type { TripStop } from "@/types/api";
import { TRIP_KEYS } from "./use-trip";

/** Add (stop === null) or edit an itinerary stop. */
export function StopDialog({ tripId, stop, open, onClose }: { tripId: number; stop: TripStop | null; open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ location_name: "", address: "", estimated_arrival_at: "", notes: "" });

  useEffect(() => {
    if (open)
      setForm({
        location_name: stop?.location_name ?? "",
        address: stop?.address ?? "",
        estimated_arrival_at: toDateTimeLocal(stop?.estimated_arrival_at),
        notes: stop?.notes ?? "",
      });
  }, [open, stop]);

  const mutation = useApiMutation(
    () => {
      const payload = {
        location_name: form.location_name,
        address: form.address || null,
        estimated_arrival_at: form.estimated_arrival_at ? fromDateTimeLocal(form.estimated_arrival_at) : null,
        notes: form.notes || null,
      };
      return stop ? stopsService.update(tripId, stop.id, payload) : stopsService.create(tripId, payload);
    },
    { invalidate: TRIP_KEYS, onSuccess: onClose },
  );
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const err = mutation.error;

  return (
    <Modal
      open={open}
      onClose={() => {
        mutation.reset();
        onClose();
      }}
      title={stop ? `Edit stop ${stop.sequence}` : "Add stop"}
      description={stop ? undefined : "New stops are inserted before the destination."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate(undefined)} loading={mutation.isPending} disabled={!form.location_name.trim()}>
            Save stop
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={err && !err.field("location_name") ? err.message : null} />
        <Field label="Location name" htmlFor="stop-name" error={err?.field("location_name")} required>
          <Input id="stop-name" value={form.location_name} onChange={set("location_name")} />
        </Field>
        <Field label="Address" htmlFor="stop-address">
          <Input id="stop-address" value={form.address} onChange={set("address")} />
        </Field>
        <Field label="Estimated arrival" htmlFor="stop-eta" error={err?.field("estimated_arrival_at")}>
          <Input id="stop-eta" type="datetime-local" value={form.estimated_arrival_at} onChange={set("estimated_arrival_at")} />
        </Field>
        <Field label="Notes" htmlFor="stop-notes">
          <Input id="stop-notes" value={form.notes} onChange={set("notes")} maxLength={255} />
        </Field>
      </div>
    </Modal>
  );
}
