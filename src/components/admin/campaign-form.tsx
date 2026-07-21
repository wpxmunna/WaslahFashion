"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createCampaign, updateCampaign } from "@/actions/admin/campaigns";
import { initialFormState } from "@/actions/types";
import {
  CheckboxField,
  FormActions,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { CAMPAIGN_MESSAGE_TYPES, CAMPAIGN_PLATFORMS } from "./campaign-form-constants";

export type CampaignFormValues = {
  id?: number;
  title: string;
  platform: string;
  messageType: string;
  content: string;
  shortContent: string;
  hashtags: string;
  callToAction: string;
  ctaUrl: string;
  imageUrl: string | null;
  scheduledAt: string;
  expiresAt: string;
  isActive: boolean;
  isPinned: boolean;
};

export function CampaignForm({ values }: { values: CampaignFormValues }) {
  const isEdit = typeof values.id === "number";

  const action = isEdit ? updateCampaign.bind(null, values.id as number) : createCampaign;
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

  const [content, setContent] = useState(values.content);

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="Message">
            <div className="grid gap-4 p-5">
              <TextField
                name="title"
                label="Title"
                required
                maxLength={255}
                hint="Internal name — not posted."
                defaultValue={values.title}
                errors={e.title}
              />
              <TextareaField
                name="content"
                label="Content"
                required
                rows={8}
                hint={`${content.length} characters. Twitter caps at 280.`}
                defaultValue={values.content}
                onChange={(ev) => setContent(ev.target.value)}
                errors={e.content}
              />
              <TextareaField
                name="shortContent"
                label="Short version"
                rows={3}
                maxLength={500}
                hint="Used where space is tight, e.g. a story caption."
                defaultValue={values.shortContent}
                errors={e.shortContent}
              />
              <TextField
                name="hashtags"
                label="Hashtags"
                maxLength={500}
                placeholder="#waslah #handloom"
                defaultValue={values.hashtags}
                errors={e.hashtags}
              />
            </div>
          </Panel>

          <Panel title="Call to action">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="callToAction"
                label="Button text"
                maxLength={255}
                placeholder="Shop the collection"
                defaultValue={values.callToAction}
                errors={e.callToAction}
              />
              <TextField
                name="ctaUrl"
                label="Destination URL"
                type="url"
                inputMode="url"
                maxLength={500}
                placeholder="https://…"
                defaultValue={values.ctaUrl}
                errors={e.ctaUrl}
              />
            </div>
          </Panel>

          <Panel
            title="Image"
            description={isEdit ? "Leave both blank to keep the current image." : undefined}
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="imageUrl"
                label="Image URL"
                placeholder="https://…"
                defaultValue=""
                errors={e.imageUrl}
              />
              <div>
                <label htmlFor="f-imageFile" className="text-sm font-medium">
                  …or upload a file
                </label>
                <input
                  id="f-imageFile"
                  name="imageFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="mt-1.5 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
                />
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Targeting">
            <div className="space-y-4 p-5">
              <SelectField
                name="platform"
                label="Platform"
                defaultValue={values.platform}
                errors={e.platform}
                options={CAMPAIGN_PLATFORMS}
              />
              <SelectField
                name="messageType"
                label="Message type"
                defaultValue={values.messageType}
                errors={e.messageType}
                options={CAMPAIGN_MESSAGE_TYPES}
              />
            </div>
          </Panel>

          <Panel title="Schedule">
            <div className="space-y-4 p-5">
              <TextField
                name="scheduledAt"
                label="Scheduled for"
                type="datetime-local"
                hint="Reminder only — nothing posts automatically."
                defaultValue={values.scheduledAt}
                errors={e.scheduledAt}
              />
              <TextField
                name="expiresAt"
                label="Expires"
                type="datetime-local"
                hint="After this the message stops being offered."
                defaultValue={values.expiresAt}
                errors={e.expiresAt}
              />
            </div>
          </Panel>

          <Panel title="Status">
            <div className="space-y-3 p-5">
              <CheckboxField
                name="isActive"
                label="Active"
                hint="Inactive campaigns stay in the library but are not offered."
                defaultChecked={values.isActive}
              />
              <CheckboxField
                name="isPinned"
                label="Pinned"
                hint="Pinned campaigns sort to the top of the list."
                defaultChecked={values.isPinned}
              />
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <FormActions>
          <Link
            href="/admin/social-media/campaigns"
            className={buttonVariants({ variant: "outline" })}
          >
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create campaign"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
