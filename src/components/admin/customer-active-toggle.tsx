"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { toggleCustomerActive } from "@/actions/admin/customers";
import { Button } from "@/components/ui/button";

/**
 * Enable/disable a customer login. Staff accounts are not togglable here, so
 * the button is not rendered for them at all — the action refuses as well.
 */
export function CustomerActiveToggle({
  userId,
  isActive,
}: {
  userId: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant={isActive ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await toggleCustomerActive(userId);
          if (result.ok) {
            toast.success(result.message ?? "Saved");
            router.refresh();
          } else {
            toast.error(result.message ?? "Could not update this customer");
          }
        })
      }
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
