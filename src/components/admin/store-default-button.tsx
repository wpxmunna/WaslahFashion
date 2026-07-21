"use client";

import { useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { setDefaultStore } from "@/actions/admin/stores";
import { Button } from "@/components/ui/button";

/** Promote a store to default. The action clears the flag elsewhere in a transaction. */
export function StoreDefaultButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await setDefaultStore(id);
          if (result.ok) {
            toast.success(result.message ?? "Default store updated");
            router.refresh();
          } else {
            toast.error(result.message ?? "Could not update the default store");
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Star className="size-3.5" strokeWidth={1.8} />
      )}
      Make default
    </Button>
  );
}
