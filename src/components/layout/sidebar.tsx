"use client";

import { ChevronDown, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/layout/logo";
import { Avatar } from "@/components/ui/avatar";
import { NAVIGATION, type NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { User } from "@/types/api";

const STORAGE_KEY = "bm.sidebar.open-groups";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupIsActive(pathname: string, group: NavGroup) {
  return group.href ? isActive(pathname, group.href) : !!group.items?.some((item) => isActive(pathname, item.href));
}

interface SidebarProps {
  user: User;
  onNavigate?: () => void;
  onLogout: () => void;
  loggingOut?: boolean;
}

export function Sidebar({ user, onNavigate, onLogout, loggingOut }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Restore expanded groups, and always expand the group holding the current page.
  useEffect(() => {
    let saved: Record<string, boolean> = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
      /* storage unavailable */
    }
    const current = NAVIGATION.find((g) => g.items && groupIsActive(pathname, g));
    setOpen({ ...saved, ...(current ? { [current.label]: true } : {}) });
  }, [pathname]);

  const toggle = (label: string) =>
    setOpen((state) => {
      const next = { ...state, [label]: !state[label] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-ink-950 via-ink-900 to-ink-950 text-ink-200">
      <div className="px-5 pt-6 pb-5">
        <Link href="/dashboard" onClick={onNavigate} aria-label="BlitzMove dashboard">
          <Logo variant="light" />
        </Link>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {NAVIGATION.map((group) => {
          const Icon = group.icon;
          const active = groupIsActive(pathname, group);
          const base =
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[0.95rem] font-medium transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none";

          if (group.href) {
            return (
              <Link
                key={group.label}
                href={group.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(base, active ? "bg-brand-600 text-white shadow-lg shadow-brand-900/40" : "hover:bg-white/5 hover:text-white")}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {group.label}
              </Link>
            );
          }

          const expanded = !!open[group.label];
          const isSettings = group.label === "Settings";
          return (
            <div key={group.label}>
              <button
                onClick={() => toggle(group.label)}
                aria-expanded={expanded}
                className={cn(base, active ? "bg-brand-600 text-white shadow-lg shadow-brand-900/40" : "hover:bg-white/5 hover:text-white")}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", expanded ? "rotate-0" : "-rotate-90")} aria-hidden />
              </button>
              {expanded && (
                <ul className="mt-1 mb-2 ml-5 space-y-0.5 border-l border-white/10 pl-3">
                  {group.items!.filter((item) => !item.hidden).map((item) => {
                    const itemActive = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={itemActive ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition",
                            itemActive ? "font-semibold text-white" : "text-ink-300 hover:text-white",
                          )}
                        >
                          <span
                            className={cn("h-2 w-2 shrink-0 rounded-full border", itemActive ? "border-brand-500 bg-brand-500" : "border-ink-400")}
                            aria-hidden
                          />
                          <span className="flex-1">{item.label}</span>
                          {item.placeholder && <span className="rounded bg-white/10 px-1.5 py-px text-[0.6rem] tracking-wide text-ink-300 uppercase">Soon</span>}
                        </Link>
                      </li>
                    );
                  })}
                  {isSettings && (
                    <li>
                      <button
                        onClick={onLogout}
                        disabled={loggingOut}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink-300 transition hover:text-white disabled:opacity-60"
                      >
                        <LogOut className="h-3.5 w-3.5" aria-hidden />
                        {loggingOut ? "Signing out…" : "Logout"}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <Link href="/settings/profile" onClick={onNavigate} className="flex items-center gap-3 rounded-lg p-1 hover:bg-white/5">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-xs text-ink-400">{user.job_title ?? user.role}</p>
          </div>
        </Link>
        <p className="mt-4 text-lg leading-tight font-extrabold text-white italic">
          Move Smarter.
          <br />
          Deliver <span className="text-brand-500">Further.</span>
        </p>
      </div>
    </div>
  );
}
