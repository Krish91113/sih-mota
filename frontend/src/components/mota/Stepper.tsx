import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export type StepState = "done" | "current" | "todo" | "error";

export function StepBadge({ state, index }: { state: StepState; index: number }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
        state === "done" && "border-leaf bg-leaf text-white",
        state === "current" && "border-primary bg-primary text-primary-foreground",
        state === "error" && "border-destructive bg-destructive text-destructive-foreground",
        state === "todo" && "border-border bg-card text-muted-foreground",
      )}
    >
      {state === "done" ? <Check className="size-3.5" aria-hidden /> : index + 1}
    </span>
  );
}

export function Stepper({
  steps,
  current,
  onStepClick,
}: {
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
}) {
  const stateFor = (i: number): StepState =>
    i < current ? "done" : i === current ? "current" : "todo";
  return (
    <nav aria-label="Progress" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-2">
        {steps.map((s, i) => {
          const state = stateFor(i);
          return (
            <li key={s} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onStepClick?.(i)}
                disabled={!onStepClick}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                  state === "current" && "bg-accent text-accent-foreground",
                  onStepClick && "cursor-pointer hover:bg-accent/60",
                )}
                aria-current={state === "current" ? "step" : undefined}
              >
                <StepBadge state={state} index={i} />
                {s}
              </button>
              {i < steps.length - 1 ? (
                <span className="h-px w-6 bg-border sm:w-12" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepNav({
  onPrev,
  onNext,
  prevLabel = "Back",
  nextLabel = "Continue",
  canNext = true,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  canNext?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
      <div />
      <div className="flex gap-2">
        {onPrev ? (
          <Button type="button" variant="outline" onClick={onPrev}>
            <ChevronLeft className="size-4" aria-hidden /> {prevLabel}
          </Button>
        ) : null}
        {onNext ? (
          <Button type="button" onClick={onNext} disabled={!canNext}>
            {nextLabel} <ChevronRight className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
