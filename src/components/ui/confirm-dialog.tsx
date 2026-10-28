"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  /** Ask for an optional free-text reason that is passed to onConfirm. */
  reasonLabel?: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "danger",
  reasonLabel,
  loading,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone} loading={loading} onClick={() => onConfirm(reason.trim() || undefined)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <div className="text-sm text-ink-600">{message}</div>
        {reasonLabel && (
          <Field label={reasonLabel} htmlFor="confirm-reason">
            <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} rows={2} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
