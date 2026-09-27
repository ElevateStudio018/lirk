import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, eyebrow, description, back, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-8 flex flex-col gap-3 sm:mb-10", className)}>
      {back && (
        <Link
          href={back.href}
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-sm px-1 py-0.5 text-sm font-medium text-muted hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          {eyebrow && <p className="text-sm font-semibold uppercase tracking-wide text-brand">{eyebrow}</p>}
          <h1 className="text-title font-bold text-ink sm:text-display">{title}</h1>
          {description && <p className="max-w-2xl text-body text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
    </header>
  );
}
