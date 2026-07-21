"use client";

import { useTransition } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { FormState } from "@/actions/types";

/* -------------------------------------------------------------------------
   Row-level controls shared by the three ordered content lists (sliders,
   lookbook, social links). Each takes the module's own server action as a
   prop, so nothing here knows which table it is driving.
   ------------------------------------------------------------------------- */

function useRowAction() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<FormState>) {
    start(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Done");
        router.refresh();
      } else {
        // A failed reorder ("already at the top") is expected, not an error.
        toast.message(result.message ?? "Nothing to do");
      }
    });
  }

  return { pending, run };
}

export function ReorderButtons({
  id,
  action,
  isFirst,
  isLast,
  label,
}: {
  id: number;
  action: (id: number, direction: "up" | "down") => Promise<FormState>;
  isFirst: boolean;
  isLast: boolean;
  /** Human name of the row, for the screen-reader label. */
  label: string;
}) {
  const { pending, run } = useRowAction();

  return (
    <span className="inline-flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending || isFirst}
        onClick={() => run(() => action(id, "up"))}
        aria-label={`Move ${label} up`}
      >
        <ChevronUp strokeWidth={1.8} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending || isLast}
        onClick={() => run(() => action(id, "down"))}
        aria-label={`Move ${label} down`}
      >
        <ChevronDown strokeWidth={1.8} />
      </Button>
    </span>
  );
}

export function ToggleActiveButton({
  id,
  action,
  isActive,
  label,
}: {
  id: number;
  action: (id: number) => Promise<FormState>;
  isActive: boolean;
  label: string;
}) {
  const { pending, run } = useRowAction();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => run(() => action(id))}
      aria-label={`${isActive ? "Hide" : "Show"} ${label}`}
      className={isActive ? "text-emerald-600" : "text-muted-foreground"}
    >
      {isActive ? <Eye strokeWidth={1.8} /> : <EyeOff strokeWidth={1.8} />}
      {isActive ? "Live" : "Hidden"}
    </Button>
  );
}

export function FeatureButton({
  id,
  action,
  isFeatured,
  label,
}: {
  id: number;
  action: (id: number) => Promise<FormState>;
  isFeatured: boolean;
  label: string;
}) {
  const { pending, run } = useRowAction();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      onClick={() => run(() => action(id))}
      aria-label={isFeatured ? `Unfeature ${label}` : `Feature ${label}`}
      aria-pressed={isFeatured}
      className={isFeatured ? "text-amber-500" : "text-muted-foreground"}
    >
      <Star strokeWidth={1.8} fill={isFeatured ? "currentColor" : "none"} />
    </Button>
  );
}
