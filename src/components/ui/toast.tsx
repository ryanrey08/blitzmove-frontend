"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectToasts, toastAdded, toastDismissed, type ToastTone } from "@/store/slices/notificationsSlice";

const TOAST_MS = 4500;

/** Renders the toast stack from the notifications slice; mounted once in Providers. */
export function Toaster() {
  const toasts = useAppSelector(selectToasts);

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg",
            toast.tone === "success" ? "border-emerald-200" : "border-brand-200",
          )}
        >
          {toast.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          )}
          <span className="text-ink-800">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

/** Returns `notify(message, tone?)`, which shows a toast for a few seconds. */
export function useToast() {
  const dispatch = useAppDispatch();
  return useCallback(
    (message: string, tone: ToastTone = "success") => {
      const { payload } = dispatch(toastAdded(message, tone));
      setTimeout(() => dispatch(toastDismissed(payload.id)), TOAST_MS);
    },
    [dispatch],
  );
}
