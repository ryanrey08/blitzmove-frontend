"use client";

import { Ban, CheckCircle2, Play, Send, Undo2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { tripsService } from "@/services/resources";
import type { Trip, TripStatus } from "@/types/api";
import { TRIP_KEYS } from "./use-trip";

export const DISPATCH_PATH = "/transportation/dispatch";
export const dispatchPath = (trip: Pick<Trip, "id">) => `${DISPATCH_PATH}/${trip.id}`;

/**
 * One entry per transition in TripStatus::allowedTransitions(). Which ones a
 * trip offers comes from the API's `allowed_transitions`, so the UI never shows
 * a move the backend would reject.
 */
export const TRANSITIONS: Record<
  Exclude<TripStatus, "scheduled"> | "recall",
  { label: string; icon: ReactNode; title: string; message: string; confirm: string; tone: "danger" | "primary"; reason?: string }
> = {
  dispatched: { label: "Dispatch", icon: <Send />, title: "Dispatch trip", message: "", confirm: "Dispatch", tone: "primary" },
  in_progress: {
    label: "Start Trip",
    icon: <Play />,
    title: "Start trip",
    message: "Mark the trip as departed? The vehicle, driver and order switch to on-trip / in-transit.",
    confirm: "Start trip",
    tone: "primary",
  },
  completed: {
    label: "Complete Trip",
    icon: <CheckCircle2 />,
    title: "Complete trip",
    message: "Mark all remaining stops done and the order delivered?",
    confirm: "Complete trip",
    tone: "primary",
  },
  recall: {
    label: "Recall to Scheduled",
    icon: <Undo2 />,
    title: "Recall dispatch",
    message: "Move this trip back to Scheduled so it can be edited or re-dispatched?",
    confirm: "Recall",
    tone: "primary",
  },
  cancelled: {
    label: "Cancel Trip",
    icon: <Ban />,
    title: "Cancel trip",
    message: "Cancel this trip? A scheduled order returns to Pending.",
    confirm: "Cancel trip",
    tone: "danger",
    reason: "Reason (optional)",
  },
};

export type TransitionKey = keyof typeof TRANSITIONS;

/** Transitions a trip allows, in display order (dispatch is done on the dispatch page, not here). */
export function availableTransitions(trip: Pick<Trip, "status" | "allowed_transitions">): TransitionKey[] {
  const allowed = trip.allowed_transitions;
  const keys: TransitionKey[] = [];
  if (allowed.includes("in_progress")) keys.push("in_progress");
  if (allowed.includes("completed")) keys.push("completed");
  if (allowed.includes("scheduled")) keys.push("recall");
  if (allowed.includes("cancelled")) keys.push("cancelled");
  return keys;
}

/** Confirm-then-PATCH status changes; render `dialog` once and call `request(trip, key)`. */
export function useTripTransition(onDone?: (trip: Trip) => void) {
  const [pending, setPending] = useState<{ trip: Trip; key: TransitionKey } | null>(null);
  const change = useApiMutation(
    ({ trip, key, reason }: { trip: Trip; key: TransitionKey; reason?: string }) =>
      tripsService.changeStatus(trip.id, key === "recall" ? "scheduled" : (key as TripStatus), reason),
    {
      invalidate: TRIP_KEYS,
      onSuccess: (result) => {
        setPending(null);
        onDone?.(result.data);
      },
    },
  );
  const copy = pending ? TRANSITIONS[pending.key] : null;

  const dialog = (
    <ConfirmDialog
      open={!!pending}
      title={copy?.title ?? ""}
      message={
        <>
          <strong>{pending?.trip.trip_number}</strong> · {copy?.message}
        </>
      }
      confirmLabel={copy?.confirm}
      tone={copy?.tone}
      reasonLabel={copy?.reason}
      loading={change.isPending}
      error={change.error?.field("status") ?? change.error?.message}
      onConfirm={(reason) => pending && change.mutate({ ...pending, reason })}
      onClose={() => {
        change.reset();
        setPending(null);
      }}
    />
  );

  return { request: (trip: Trip, key: TransitionKey) => setPending({ trip, key }), dialog, pending: change.isPending };
}
