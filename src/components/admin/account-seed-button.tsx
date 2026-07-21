"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { seedChartOfAccounts } from "@/actions/admin/accounting";
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

/**
 * One-shot bootstrap for a store with no chart of accounts. Confirmed, because
 * it writes two dozen rows; the action itself refuses to run on a non-empty
 * chart, so a double click cannot duplicate anything.
 */
export function AccountSeedButton({ label = "Seed standard accounts" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const result = await seedChartOfAccounts();
      if (result.ok) {
        toast.success(result.message ?? "Accounts created");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not seed the chart of accounts");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="lg">
            <Sparkles className="size-4" strokeWidth={1.8} />
            {label}
          </Button>
        }
      />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create the standard chart of accounts?</DialogTitle>
          <DialogDescription>
            This adds 24 system accounts — cash, bank, receivables, inventory, payables,
            sales revenue, cost of goods sold and the common expense accounts. They cannot
            be deleted afterwards, only deactivated. It only runs while the chart is empty.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={run} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create accounts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
