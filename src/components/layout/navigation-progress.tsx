"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Phase = "idle" | "loading" | "done";

/**
 * Thin bar at the top of the window from the moment an in-app link is clicked until
 * the new page is on screen. The router gives no feedback while the next page's
 * server payload (or, in development, its first compile) is on its way.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const current = useRef("");

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Next's <Link> has already called preventDefault for client-side navigations.
      if (!event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname + url.search === window.location.pathname + window.location.search) return;
      setPhase("loading");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // The URL changes once the new page has rendered.
  useEffect(() => {
    const url = `${pathname}?${searchParams}`;
    if (current.current && current.current !== url) setPhase((p) => (p === "loading" ? "done" : p));
    current.current = url;
  }, [pathname, searchParams]);

  // Fade out after finishing; give up on a navigation that never landed (cancelled or failed).
  useEffect(() => {
    if (phase === "idle") return;
    const timer = setTimeout(() => setPhase("idle"), phase === "done" ? 300 : 20_000);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 print:hidden" aria-hidden>
      <div
        className={cn(
          "h-full bg-brand-600 shadow-[0_0_8px] shadow-brand-500",
          phase === "idle" && "w-0 opacity-0",
          phase === "loading" && "w-[85%] opacity-100 transition-[width] duration-[8s] ease-out",
          phase === "done" && "w-full opacity-0 transition-[width,opacity] duration-300",
        )}
      />
    </div>
  );
}
