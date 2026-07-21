"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { postJournalEntry, reverseJournalEntry } from "@/actions/admin/accounting";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FormState } from "@/actions/types";

function ConfirmAction({
  id,
  action,
  label,
  icon,
  title,
  body,
  variant = "default",
}: {
  id: number;
  action: (id: number) => Promise<FormState>;
  label: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const result = await action(id);
      if (result.ok) {
        toast.success(result.message ?? "Done");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "That did not work");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={variant} size="lg">
            {icon}
            {label}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={run} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Post / reverse controls for a single journal entry. */
export function JournalEntryActions({
  id,
  status,
}: {
  id: number;
  status: "DRAFT" | "POSTED" | "REVERSED";
}) {
  if (status === "DRAFT") {
    return (
      <ConfirmAction
        id={id}
        action={postJournalEntry}
        label="Post entry"
        icon={<CheckCircle2 className="size-4" strokeWidth={1.8} />}
        title="Post this entry?"
        body="Posting applies each line to its account balance. A posted entry cannot be edited or deleted — it can only be reversed."
      />
    );
  }

  if (status === "POSTED") {
    return (
      <ConfirmAction
        id={id}
        action={reverseJournalEntry}
        label="Reverse entry"
        icon={<Undo2 className="size-4" strokeWidth={1.8} />}
        variant="outline"
        title="Reverse this entry?"
        body="A mirrored entry is created with the debits and credits swapped, cancelling this one's effect on every account balance. Both entries stay in the ledger."
      />
    );
  }

  return null;
}
