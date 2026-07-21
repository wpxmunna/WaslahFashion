"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addCampaignGoal, deleteCampaignGoal } from "@/actions/admin/campaigns";
import { initialFormState } from "@/actions/types";
import {
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/admin/form-fields";
import { EmptyState, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

export type CampaignGoalRow = {
  id: number;
  type: string;
  targetValue: number;
  /** Live figure taken from the campaign counters for this goal's metric. */
  currentValue: number;
  startDate: string | null;
  endDate: string | null;
};

const GOAL_LABELS: Record<string, string> = {
  VIEWS: "Views",
  COPIES: "Copies",
  CLICKS: "Clicks",
  SHARES: "Shares",
  ENGAGEMENTS: "Engagements",
};

export function CampaignGoals({
  campaignId,
  goals,
}: {
  campaignId: number;
  goals: CampaignGoalRow[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  const [state, formAction] = useActionState(
    addCampaignGoal.bind(null, campaignId),
    initialFormState,
  );
  const e = state.errors ?? {};

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  function remove(id: number) {
    start(async () => {
      const result = await deleteCampaignGoal(id);
      if (result.ok) {
        toast.success(result.message ?? "Removed");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not remove that goal");
      }
    });
  }

  return (
    <Panel title="Goals" description="Progress is measured against all-time totals.">
      {goals.length === 0 ? (
        <EmptyState
          title="No goals set"
          description="Add a target so you can tell whether this campaign did its job."
        />
      ) : (
        <ul className="divide-y divide-border">
          {goals.map((goal) => {
            const percent =
              goal.targetValue > 0
                ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 1000) / 10)
                : 0;
            const done = goal.currentValue >= goal.targetValue;

            return (
              <li key={goal.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {GOAL_LABELS[goal.type] ?? goal.type}
                    {(goal.startDate || goal.endDate) && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {goal.startDate ?? "…"} → {goal.endDate ?? "…"}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {goal.currentValue.toLocaleString()} /{" "}
                      {goal.targetValue.toLocaleString()} ({percent}%)
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={pending}
                      onClick={() => remove(goal.id)}
                      aria-label={`Remove the ${GOAL_LABELS[goal.type] ?? goal.type} goal`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 strokeWidth={1.8} />
                    </Button>
                  </div>
                </div>

                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${GOAL_LABELS[goal.type] ?? goal.type} goal progress`}
                >
                  <div
                    className={done ? "h-full bg-emerald-500" : "h-full bg-primary"}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="grid gap-3 border-t border-border p-5 sm:grid-cols-2"
      >
        {state.message && (
          <div className="sm:col-span-2">
            <FormMessage state={state} />
          </div>
        )}

        <SelectField
          name="type"
          label="Metric"
          errors={e.type}
          options={Object.entries(GOAL_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <TextField
          name="targetValue"
          label="Target"
          type="number"
          min="1"
          required
          errors={e.targetValue}
        />
        <TextField name="startDate" label="Start date" type="date" errors={e.startDate} />
        <TextField name="endDate" label="End date" type="date" errors={e.endDate} />

        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton>Add goal</SubmitButton>
        </div>
      </form>
    </Panel>
  );
}
