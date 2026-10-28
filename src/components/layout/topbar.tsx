"use client";

import { ChevronDown, LogOut, Menu, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { GlobalSearch } from "@/components/layout/global-search";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { humanize } from "@/lib/utils";
import type { User } from "@/types/api";

interface TopbarProps {
  user: User;
  onMenuClick: () => void;
  onLogout: () => void;
}

export function Topbar({ user, onMenuClick, onLogout }: TopbarProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 flex h-[4.5rem] items-center gap-3 border-b border-ink-100 bg-white/95 px-4 backdrop-blur sm:gap-5 sm:px-6">
      <button onClick={onMenuClick} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100" aria-label="Toggle navigation">
        <Menu className="h-6 w-6" />
      </button>
      <GlobalSearch />
      <div className="ml-auto">
        <Dropdown
          trigger={({ toggle, open }) => (
            <button onClick={toggle} aria-expanded={open} className="flex items-center gap-3 rounded-lg p-1 pr-2 hover:bg-ink-50">
              <Avatar name={user.name} />
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-semibold text-ink-900">{user.name}</span>
                <span className="block text-xs text-ink-500">{user.job_title ?? humanize(user.role)}</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-ink-500 sm:block" />
            </button>
          )}
          items={[
            { label: "Profile", icon: <UserCircle />, onSelect: () => router.push("/settings/profile") },
            { label: "Logout", icon: <LogOut />, onSelect: onLogout, danger: true },
          ]}
        />
      </div>
    </header>
  );
}
