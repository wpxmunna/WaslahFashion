"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import type { FormState } from "@/actions/types";

/**
 * Confirmed destructive action.
 *
 * Deliberately a dialog rather than `window.confirm` — a native confirm blocks
 * the whole renderer and can't be styled or tested.
 */
export function DeleteButton({
  id,
  action,
  label = "Delete",
  confirmTitle = "Are you sure?",
  confirmBody = "This cannot be undone.",
  redirectTo,
}: {
  id: number;
  action: (id: number) => Promise<FormState>;
  label?: string;
  confirmTitle?: string;
  confirmBody?: string;
  /** Navigate here on success — use when deleting from a detail page. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const result = await action(id);
      if (result.ok) {
        toast.success(result.message ?? "Deleted");
        setOpen(false);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        toast.error(result.message ?? "Could not delete");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
      >
        <Trash2 className="size-3.5" strokeWidth={1.8} />
        {label}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmTitle}</DialogTitle>
          <DialogDescription>{confirmBody}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline">Cancel</Button>}
          />
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
