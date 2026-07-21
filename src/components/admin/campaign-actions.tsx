"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Copy, CopyPlus, Pause, Pin, PinOff, Play } from "lucide-react";
import { toast } from "sonner";

import {
  duplicateCampaign,
  recordCampaignCopy,
  toggleCampaignActive,
  toggleCampaignPinned,
} from "@/actions/admin/campaigns";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/actions/types";

function useCampaignAction() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<FormState>, onSuccess?: () => void) {
    start(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Done");
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(result.message ?? "That did not work");
      }
    });
  }

  return { pending, run };
}

/**
 * Copies the message to the clipboard and records the copy server-side.
 *
 * The clipboard write happens first and inside the click handler — Safari only
 * honours `navigator.clipboard` while the user gesture is still on the stack,
 * so awaiting the server action first would silently fail there.
 */
export function CampaignCopyButton({
  id,
  text,
  size = "sm",
}: {
  id: number;
  text: string;
  size?: "sm" | "default";
}) {
  const { pending, run } = useCampaignAction();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast.error("Your browser blocked the clipboard. Select the text and copy manually.");
      return;
    }
    run(() => recordCampaignCopy(id));
  }

  return (
    <Button variant="outline" size={size} disabled={pending} onClick={copy}>
      <Copy strokeWidth={1.8} />
      Copy message
    </Button>
  );
}

export function CampaignToggleActive({
  id,
  isActive,
  size = "sm",
}: {
  id: number;
  isActive: boolean;
  size?: "sm" | "default";
}) {
  const { pending, run } = useCampaignAction();

  return (
    <Button
      variant="outline"
      size={size}
      disabled={pending}
      onClick={() => run(() => toggleCampaignActive(id))}
    >
      {isActive ? <Pause strokeWidth={1.8} /> : <Play strokeWidth={1.8} />}
      {isActive ? "Pause" : "Activate"}
    </Button>
  );
}

export function CampaignTogglePinned({
  id,
  isPinned,
  size = "sm",
}: {
  id: number;
  isPinned: boolean;
  size?: "sm" | "default";
}) {
  const { pending, run } = useCampaignAction();

  return (
    <Button
      variant="outline"
      size={size}
      disabled={pending}
      onClick={() => run(() => toggleCampaignPinned(id))}
      aria-pressed={isPinned}
    >
      {isPinned ? <PinOff strokeWidth={1.8} /> : <Pin strokeWidth={1.8} />}
      {isPinned ? "Unpin" : "Pin"}
    </Button>
  );
}

export function CampaignDuplicate({
  id,
  size = "sm",
}: {
  id: number;
  size?: "sm" | "default";
}) {
  const { pending, run } = useCampaignAction();

  return (
    <Button
      variant="outline"
      size={size}
      disabled={pending}
      onClick={() => run(() => duplicateCampaign(id))}
    >
      <CopyPlus strokeWidth={1.8} />
      Duplicate
    </Button>
  );
}
