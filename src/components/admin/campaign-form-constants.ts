/**
 * Plain-value exports for `campaign-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { CampaignFormValues } from "./campaign-form";

export const CAMPAIGN_PLATFORMS = [
  { value: "ALL", label: "All platforms" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "TWITTER", label: "X / Twitter" },
];

export const CAMPAIGN_MESSAGE_TYPES = [
  { value: "PROMOTION", label: "Promotion" },
  { value: "ANNOUNCEMENT", label: "Announcement" },
  { value: "GREETING", label: "Greeting" },
  { value: "OFFER", label: "Offer" },
  { value: "EVENT", label: "Event" },
  { value: "CUSTOM", label: "Custom" },
];

export const emptyCampaignValues: CampaignFormValues = {
  title: "",
  platform: "ALL",
  messageType: "PROMOTION",
  content: "",
  shortContent: "",
  hashtags: "",
  callToAction: "",
  ctaUrl: "",
  imageUrl: null,
  scheduledAt: "",
  expiresAt: "",
  isActive: true,
  isPinned: false,
};
