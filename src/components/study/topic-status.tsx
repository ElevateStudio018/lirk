import { STATUS_LABEL, type MasteryStatus } from "@/lib/engine/mastery";
import { cn } from "@/lib/utils";

export const STATUS_STYLES: Record<MasteryStatus, { dot: string; soft: string; text: string; ring: string }> = {
  good: { dot: "bg-good", soft: "bg-good-soft", text: "text-good", ring: "stroke-good" },
  warn: { dot: "bg-warn", soft: "bg-warn-soft", text: "text-warn", ring: "stroke-warn" },
  bad: { dot: "bg-bad", soft: "bg-bad-soft", text: "text-bad", ring: "stroke-bad" },
  unknown: { dot: "bg-unknown", soft: "bg-unknown-soft", text: "text-unknown", ring: "stroke-unknown" },
};

export function StatusDot({ status, className }: { status: MasteryStatus; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", STATUS_STYLES[status].dot, className)} aria-label={STATUS_LABEL[status]} />;
}

export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
      {(["good", "warn", "bad", "unknown"] as const).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <StatusDot status={s} /> {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

export function TopicChips({ topics }: { topics: Array<{ id: string; title: string; status: MasteryStatus }> }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {topics.map((t) => (
        <li key={t.id} className={cn("inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-ink", STATUS_STYLES[t.status].soft)}>
          <StatusDot status={t.status} />
          {t.title}
        </li>
      ))}
    </ul>
  );
}
