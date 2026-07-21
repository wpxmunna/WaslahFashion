"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { toggleCoupon } from "@/actions/admin/coupons";
import { cn } from "@/lib/utils";

/** Flip a coupon's active flag straight from the list. */
export function CouponToggle({
  id,
  code,
  isActive,
}: {
  id: number;
  code: string;
  isActive: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`${isActive ? "Deactivate" : "Activate"} ${code}`}
      onClick={() =>
        start(async () => {
          const r = await toggleCoupon(id);
          if (r.ok) toast.success(r.message ?? "Updated");
          else toast.error(r.message ?? "Could not update the coupon");
        })
      }
      className={cn(
        "rounded-md border border-border px-2.5 py-1 text-xs transition-colors hover:bg-secondary",
        pending && "opacity-50",
      )}
    >
      {isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
