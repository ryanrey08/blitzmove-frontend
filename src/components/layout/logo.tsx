import { cn } from "@/lib/utils";

/** BlitzMove mark: a chevron cutting into a "B", in brand red and charcoal. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden>
      <path d="M2 4h20l14 20-14 20H2l14-20z" fill="currentColor" className="text-ink-900" />
      <path d="M26 4h18c9 0 15 4.6 15 11.2 0 4.3-2.4 7.4-6.2 8.8 4.6 1.3 7.6 4.8 7.6 9.6C60.4 40 54 44 44.8 44H26l14-20z" fill="#e30613" />
      <path d="M16 24 2 4h6l14 20L8 44H2z" fill="#e30613" opacity=".9" />
    </svg>
  );
}

export function Logo({ variant = "dark", className, compact = false }: { variant?: "dark" | "light"; className?: string; compact?: boolean }) {
  const light = variant === "light";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={cn("h-9 w-12 shrink-0", light && "[&_.text-ink-900]:text-white")} />
      {!compact && (
        <div className="leading-none">
          <p className="text-2xl font-black tracking-tight italic">
            <span className={light ? "text-white" : "text-ink-900"}>Blitz</span>
            <span className="text-brand-600">Move</span>
          </p>
          <p className={cn("mt-1 text-[0.55rem] font-semibold tracking-[0.35em]", light ? "text-ink-300" : "text-ink-600")}>LOGISTICS SOLUTIONS</p>
        </div>
      )}
    </div>
  );
}
