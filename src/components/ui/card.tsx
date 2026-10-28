import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-ink-100 bg-white shadow-card", className)} {...props} />;
}

interface CardHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, icon, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className="text-ink-800 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-ink-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
