import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };
const tones = {
  info: "bg-info-soft text-info",
  success: "bg-good-soft text-good",
  warning: "bg-warn-soft text-warn",
  error: "bg-bad-soft text-bad",
};

type AlertProps = {
  tone?: keyof typeof icons;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function Alert({ tone = "info", title, children, action, className }: AlertProps) {
  const Icon = icons[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg p-4", tones[tone], className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn("text-sm text-text", title && "mt-0.5")}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
