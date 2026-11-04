"use client";

import { KeyRound, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FormError, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { cn } from "@/lib/utils";
import type { ManagedUser, UserStatus } from "@/types/api";
import { USER_KEYS, usersService } from "./api";

export type UserAction = { kind: "status"; status: UserStatus } | { kind: "reset" } | { kind: "delete" };

const STATUS_COPY: Record<UserStatus, { title: string; confirm: string; message: string; tone: "primary" | "danger" }> = {
  active: { title: "Activate account", confirm: "Activate", message: "can sign in again with their existing password.", tone: "primary" },
  inactive: { title: "Deactivate account", confirm: "Deactivate", message: "is signed out everywhere and cannot sign in until reactivated.", tone: "danger" },
  suspended: { title: "Suspend account", confirm: "Suspend", message: "is signed out everywhere and cannot sign in while suspended.", tone: "danger" },
};

/** Confirmation dialogs for status changes, password resets and deletion. */
export function UserActionDialogs({ user, action, onClose, onDeleted }: { user: ManagedUser | null; action: UserAction | null; onClose: () => void; onDeleted?: () => void }) {
  const status = useApiMutation((s: UserStatus) => usersService.setStatus(user!.id, s), { invalidate: USER_KEYS, onSuccess: onClose });
  const remove = useApiMutation(() => usersService.remove(user!.id), {
    invalidate: USER_KEYS,
    onSuccess: () => {
      onClose();
      onDeleted?.();
    },
  });
  const close = () => {
    status.reset();
    remove.reset();
    onClose();
  };
  if (!user || !action) return null;

  if (action.kind === "reset") return <ResetPasswordDialog user={user} onClose={onClose} />;

  if (action.kind === "delete") {
    return (
      <ConfirmDialog
        open
        title="Delete user"
        message={
          <>
            Delete <strong>{user.name}</strong> ({user.email})? They are signed out and can no longer sign in. The record is kept (soft delete) so history stays intact, and the
            email and username stay reserved.
          </>
        }
        confirmLabel="Delete user"
        loading={remove.isPending}
        error={remove.error?.field("user") ?? remove.error?.message}
        onConfirm={() => remove.mutate(undefined)}
        onClose={close}
      />
    );
  }

  const copy = STATUS_COPY[action.status];
  return (
    <ConfirmDialog
      open
      title={copy.title}
      tone={copy.tone}
      message={
        <>
          <strong>{user.name}</strong> {copy.message}
        </>
      }
      confirmLabel={copy.confirm}
      loading={status.isPending}
      error={status.error?.field("status") ?? status.error?.message}
      onConfirm={() => status.mutate(action.status)}
      onClose={close}
    />
  );
}

function ResetPasswordDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const [mode, setMode] = useState<"link" | "set">("link");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const reset = useApiMutation(() => usersService.resetPassword(user.id, mode === "link" ? { mode } : { mode, password, password_confirmation: confirmation }), {
    invalidate: [],
    onSuccess: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Reset password"
      description={`For ${user.name}. Every session they have open is signed out.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={reset.isPending}>
            Cancel
          </Button>
          <Button onClick={() => reset.mutate(undefined)} loading={reset.isPending} disabled={mode === "set" && (!password || !confirmation)}>
            {mode === "link" ? "Send reset link" : "Set password"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={reset.error && reset.error.status !== 422 ? reset.error.message : (reset.error?.field("mode") ?? null)} />
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["link", Mail, "Email a reset link", `Sent to ${user.email}; they choose their own password.`],
              ["set", KeyRound, "Set a new password", "You give them a temporary password."],
            ] as const
          ).map(([value, Icon, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn("rounded-lg border p-3 text-left text-sm transition", mode === value ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500" : "border-ink-200 hover:border-ink-300")}
              aria-pressed={mode === value}
            >
              <Icon className="mb-1 h-4 w-4 text-brand-600" />
              <span className="block font-semibold text-ink-900">{label}</span>
              <span className="text-xs text-ink-500">{hint}</span>
            </button>
          ))}
        </div>
        {mode === "set" && (
          <div className="grid gap-3">
            <Field label="New password" htmlFor="reset-password" required error={reset.error?.field("password")} hint="At least 10 characters with upper and lower case letters, a number and a symbol.">
              <Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!reset.error?.field("password")} />
            </Field>
            <Field label="Confirm password" htmlFor="reset-password-confirm" required>
              <Input id="reset-password-confirm" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Menu entries for a user row / details page, filtered by the signed-in user's permissions. */
export function userMenuItems({
  user,
  self,
  can,
  onAction,
}: {
  user: ManagedUser;
  self: boolean;
  can: (permission: string) => boolean;
  onAction: (action: UserAction) => void;
}) {
  const items: { label: string; status?: UserStatus; kind: UserAction["kind"]; danger?: boolean }[] = [];
  if (!self) {
    if (user.status !== "active" && can("users.activate")) items.push({ label: "Activate", kind: "status", status: "active" });
    if (user.status === "active" && can("users.deactivate")) items.push({ label: "Deactivate", kind: "status", status: "inactive" });
    if (user.status !== "suspended" && can("users.deactivate")) items.push({ label: "Suspend", kind: "status", status: "suspended", danger: true });
    if (can("users.reset_password")) items.push({ label: "Reset password", kind: "reset" });
    if (can("users.delete")) items.push({ label: "Delete", kind: "delete", danger: true });
  }
  return items.map((item) => ({
    ...item,
    onSelect: () => onAction(item.kind === "status" ? { kind: "status", status: item.status! } : ({ kind: item.kind } as UserAction)),
  }));
}
