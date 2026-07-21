"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { toggleWishlist } from "@/actions/wishlist";
import { cn } from "@/lib/utils";

export function WishlistButton({
  productId,
  initialSaved = false,
  variant = "icon",
  className,
}: {
  productId: number;
  initialSaved?: boolean;
  variant?: "icon" | "full";
  className?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();

  function toggle() {
    // Optimistic — reverted below if the server disagrees.
    const next = !saved;
    setSaved(next);

    start(async () => {
      const result = await toggleWishlist(productId);

      if (result.requiresAuth) {
        setSaved(!next);
        toast.error(result.message);
        router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      if (!result.ok) {
        setSaved(!next);
        toast.error(result.message);
        return;
      }

      setSaved(result.added ?? next);
      toast.success(result.message);
    });
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
        className={cn(
          "grid size-9 place-items-center rounded-full bg-background/85 backdrop-blur transition-colors hover:bg-background",
          className,
        )}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Heart
            className={cn("size-4 transition-colors", saved && "fill-destructive text-destructive")}
            strokeWidth={1.7}
          />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 border border-border px-5 text-sm transition-colors hover:bg-secondary",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Heart
          className={cn("size-4", saved && "fill-destructive text-destructive")}
          strokeWidth={1.7}
        />
      )}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
