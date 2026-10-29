import { cn, initials } from "@/lib/utils";

const palette = ["bg-brand-600", "bg-sky-600", "bg-emerald-600", "bg-amber-600", "bg-violet-600", "bg-ink-700"];
const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-2xl",
};

/** Initials avatar, or the photo at `src` when one is given. */
export function Avatar({ name, src, size = "md", className }: { name: string; src?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- photos are served by the API, not static assets
    return <img src={src} alt={name} className={cn("inline-block shrink-0 rounded-full object-cover", sizes[size], className)} />;
  }
  const color = palette[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % palette.length];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", color, sizes[size], className)} aria-hidden>
      {initials(name)}
    </span>
  );
}
