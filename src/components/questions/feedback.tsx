import { CheckCircle2, CircleDot, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type Feedback = { score: number; is_correct: boolean; feedback: string; correct_answer?: string | null };

export function FeedbackPanel({ result, className }: { result: Feedback; className?: string }) {
  const partial = !result.is_correct && result.score >= 0.4;
  const tone = result.is_correct ? "good" : partial ? "warn" : "bad";
  const Icon = result.is_correct ? CheckCircle2 : partial ? CircleDot : XCircle;
  return (
    <div className={cn("rounded-lg p-4", tone === "good" && "bg-good-soft", tone === "warn" && "bg-warn-soft", tone === "bad" && "bg-bad-soft", className)} role="status">
      <p className={cn("flex items-center gap-2 font-semibold", tone === "good" && "text-good", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>
        <Icon className="size-5" />
        {result.is_correct ? "Rätt" : partial ? "Delvis rätt" : "Inte rätt än"}
      </p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-text">{result.feedback}</p>
      {!result.is_correct && result.correct_answer && (
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold text-ink">Rätt svar:</span> {result.correct_answer}
        </p>
      )}
    </div>
  );
}
