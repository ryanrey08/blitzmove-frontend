import Image from "next/image";
import { cn } from "@/lib/utils";

/** BlitzMove logo: truck bursting out of a road swoosh, with the "BlitzMove / Logistics Solutions" wordmark. */
export function Logo({ variant = "dark", className, priority = false }: { variant?: "dark" | "light"; className?: string; priority?: boolean }) {
  return (
    <Image
      src={variant === "light" ? "/images/blitzmove-logo-light.png" : "/images/blitzmove-logo.png"}
      alt="BlitzMove Logistics Solutions"
      width={511}
      height={294}
      priority={priority}
      className={cn("h-auto w-40", className)}
    />
  );
}
