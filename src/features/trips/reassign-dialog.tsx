"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { tripsService } from "@/services/resources";
import type { Trip } from "@/types/api";
import { TRIP_KEYS } from "./use-trip";

export function ReassignDialog({ trip, onClose }: { trip: Trip | null; onClose: () => void }) {
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setVehicleId(trip ? String(trip.vehicle_id) : "");
    setDriverId(trip ? String(trip.driver_id) : "");
    setReason("");
  }, [trip]);

  const availability = useQuery({
    queryKey: ["trips", "availability", trip?.id],
    queryFn: () => tripsService.availability(trip!.departure_at, trip!.estimated_arrival_at, trip!.id),
    enabled: !!trip,
  });
  const mutation = useApiMutation(() => tripsService.reassign(trip!.id, { vehicle_id: Number(vehicleId), driver_id: Number(driverId), reason: reason || undefined }), {
    invalidate: TRIP_KEYS,
    onSuccess: onClose,
  });

  const vehicles = availability.data?.data.vehicles ?? [];
  const drivers = availability.data?.data.drivers ?? [];
  const unchanged = trip && vehicleId === String(trip.vehicle_id) && driverId === String(trip.driver_id);

  return (
    <Modal
      open={!!trip}
      onClose={() => {
        mutation.reset();
        onClose();
      }}
      title={`Reassign ${trip?.trip_number ?? ""}`}
      description="Only vehicles and drivers free for this trip's window are listed."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate(undefined)} loading={mutation.isPending} disabled={!vehicleId || !driverId || !!unchanged}>
            Reassign
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={mutation.error ? (mutation.error.field("vehicle_id") ?? mutation.error.field("driver_id") ?? mutation.error.message) : null} />
        <Field label="Vehicle" htmlFor="re-vehicle">
          <Select
            id="re-vehicle"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            options={vehicles.map((v) => ({ value: String(v.id), label: `${v.plate_number} · ${v.make} ${v.model}${v.id === trip?.vehicle_id ? " (current)" : ""}` }))}
            placeholder={availability.isFetching ? "Checking availability…" : "Select vehicle"}
          />
        </Field>
        <Field label="Driver" htmlFor="re-driver">
          <Select
            id="re-driver"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            options={drivers.map((d) => ({ value: String(d.id), label: `${d.full_name}${d.id === trip?.driver_id ? " (current)" : ""}` }))}
            placeholder={availability.isFetching ? "Checking availability…" : "Select driver"}
          />
        </Field>
        <Field label="Reason" htmlFor="re-reason">
          <Input id="re-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Vehicle breakdown" maxLength={255} />
        </Field>
      </div>
    </Modal>
  );
}
