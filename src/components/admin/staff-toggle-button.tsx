"use client";

import { useTransition } from "react";
import { Loader2, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { toggleStaffActive } from "@/actions/admin/staff";
import { Button } from "@/components/ui/button";

/**
 * Flip a staff account's active flag. Self-deactivation and removing the last
 * active administrator are refused by the action, never merely hidden here.
 */
export function StaffToggleButton({ id, isActive }: { id: number; isActive: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await toggleStaffActive(id);
          if (result.ok) {
            toast.success(result.message ?? "Updated");
            router.refresh();
          } else {
            toast.error(result.message ?? "Could not update this account");
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Power className="size-3.5" strokeWidth={1.8} />
      )}
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
