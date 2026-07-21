"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addCampaignNote, deleteCampaignNote } from "@/actions/admin/campaigns";
import { initialFormState } from "@/actions/types";
import {
  FormMessage,
  SelectField,
  SubmitButton,
  TextareaField,
} from "@/components/admin/form-fields";
import { EmptyState, Panel, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

export type CampaignNoteRow = {
  id: number;
  note: string;
  type: string;
  author: string | null;
  createdAt: string;
};

const NOTE_TYPES = [
  { value: "GENERAL", label: "General" },
  { value: "PERFORMANCE", label: "Performance" },
  { value: "ISSUE", label: "Issue" },
  { value: "IDEA", label: "Idea" },
];

const NOTE_TONES: Record<string, "neutral" | "info" | "danger" | "accent"> = {
  GENERAL: "neutral",
  PERFORMANCE: "info",
  ISSUE: "danger",
  IDEA: "accent",
};

export function CampaignNotes({
  campaignId,
  notes,
}: {
  campaignId: number;
  notes: CampaignNoteRow[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  const [state, formAction] = useActionState(
    addCampaignNote.bind(null, campaignId),
    initialFormState,
  );
  const e = state.errors ?? {};

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  function remove(id: number) {
    start(async () => {
      const result = await deleteCampaignNote(id);
      if (result.ok) {
        toast.success(result.message ?? "Deleted");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not delete that note");
      }
    });
  }

  return (
    <Panel title="Notes">
      {notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Record what worked, what did not, and what to try next time."
        />
      ) : (
        <ul className="divide-y divide-border">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={NOTE_TYPES.find((t) => t.value === note.type)?.label ?? note.type}
                    tone={NOTE_TONES[note.type] ?? "neutral"}
                  />
                  <span className="text-xs text-muted-foreground">
                    {note.author ?? "Unknown"} · {note.createdAt}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{note.note}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                onClick={() => remove(note.id)}
                aria-label="Delete this note"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 strokeWidth={1.8} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="space-y-3 border-t border-border p-5">
        {state.message && <FormMessage state={state} />}

        <TextareaField
          name="note"
          label="Add a note"
          rows={3}
          required
          maxLength={5000}
          errors={e.note}
        />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SelectField
            name="type"
            label="Type"
            errors={e.type}
            options={NOTE_TYPES}
            className="w-44"
          />
          <SubmitButton>Add note</SubmitButton>
        </div>
      </form>
    </Panel>
  );
}
