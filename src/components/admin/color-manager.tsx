"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  createColor,
  deleteColor,
  toggleColor,
  updateColor,
} from "@/actions/admin/colors";
import { initialFormState, type FormState } from "@/actions/types";
import {
  CheckboxField,
  FormMessage,
  SubmitButton,
  TextField,
} from "@/components/admin/form-fields";
import { EmptyState, Panel, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ColorRow = {
  id: number;
  name: string;
  hex: string;
  sortOrder: number;
  isActive: boolean;
  /** Product variants pointing at this colour — drives delete vs deactivate. */
  variantCount: number;
};

/** `#rrggbb` only; anything else leaves the native picker on its default. */
function pickerValue(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000";
}

/**
 * Name + hex pair with a native colour picker wired to the text input.
 *
 * The text field stays the source of truth so an admin can paste a brand hex,
 * while the swatch gives a way to choose one without knowing the code.
 */
function HexFields({
  defaultName,
  defaultHex,
  errors,
  idPrefix,
}: {
  defaultName: string;
  defaultHex: string;
  errors: Record<string, string[]>;
  idPrefix: string;
}) {
  const [hex, setHex] = useState(defaultHex);

  return (
    <>
      <TextField
        name="name"
        label="Colour name"
        required
        maxLength={50}
        placeholder="Indigo"
        defaultValue={defaultName}
        errors={errors.name}
      />
      <div>
        <label htmlFor={`f-hex-${idPrefix}`} className="text-sm font-medium">
          Hex code
          <span className="ml-0.5 text-destructive">*</span>
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            id={`f-hex-${idPrefix}`}
            name="hex"
            required
            maxLength={7}
            value={hex}
            onChange={(ev) => setHex(ev.target.value)}
            placeholder="#2B3A67"
            aria-invalid={errors.hex?.length ? true : undefined}
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm uppercase outline-none transition-colors",
              errors.hex?.length
                ? "border-destructive focus:border-destructive"
                : "border-border focus:border-primary",
            )}
          />
          <input
            type="color"
            value={pickerValue(hex)}
            onChange={(ev) => setHex(ev.target.value)}
            aria-label="Pick a colour"
            className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-background p-1"
          />
        </div>
        {errors.hex?.length ? (
          <p className="mt-1 text-xs text-destructive">{errors.hex[0]}</p>
        ) : null}
      </div>
    </>
  );
}

function Swatch({ hex, muted }: { hex: string; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-7 shrink-0 rounded-full border border-black/10 shadow-sm",
        muted && "opacity-40",
      )}
      style={{ backgroundColor: hex }}
    />
  );
}

function AddColorForm() {
  const [state, setState] = useState<FormState>(initialFormState);
  // Remounting the inputs on success clears them — a `<form>` action does not
  // reset itself, and `form.reset()` would not clear the controlled hex field.
  const [nonce, setNonce] = useState(0);
  const [, start] = useTransition();

  function submit(formData: FormData) {
    start(async () => {
      const result = await createColor(initialFormState, formData);
      setState(result);
      if (result.ok) {
        toast.success(result.message ?? "Colour added");
        setNonce((n) => n + 1);
      }
    });
  }

  return (
    <form key={nonce} action={submit} className="space-y-4 p-5">
      {!state.ok && <FormMessage state={state} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HexFields
          idPrefix={`new-${nonce}`}
          defaultName=""
          defaultHex="#000000"
          errors={state.errors ?? {}}
        />
        <TextField
          name="sortOrder"
          label="Sort order"
          type="number"
          min="0"
          placeholder="Auto"
          hint="Blank adds it to the end."
          errors={state.errors?.sortOrder}
        />
        <div className="flex items-end pb-1">
          <SubmitButton>Add colour</SubmitButton>
        </div>
      </div>
      <input type="hidden" name="isActive" value="1" />
    </form>
  );
}

function ColorListRow({ color }: { color: ColorRow }) {
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, start] = useTransition();

  function save(formData: FormData) {
    start(async () => {
      const result = await updateColor(color.id, initialFormState, formData);
      setState(result);
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        setEditing(false);
      }
    });
  }

  function run(fn: () => Promise<FormState>, fallback: string) {
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? fallback);
      else toast.error(r.message ?? "Something went wrong");
    });
  }

  if (editing) {
    return (
      <li className="p-5">
        <form action={save} className="space-y-4">
          {!state.ok && <FormMessage state={state} />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HexFields
              idPrefix={String(color.id)}
              defaultName={color.name}
              defaultHex={color.hex}
              errors={state.errors ?? {}}
            />
            <TextField
              name="sortOrder"
              label="Sort order"
              type="number"
              min="0"
              defaultValue={String(color.sortOrder)}
              errors={state.errors?.sortOrder}
            />
            <div className="flex items-end pb-1">
              <CheckboxField
                name="isActive"
                label="Active"
                defaultChecked={color.isActive}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton>Save colour</SubmitButton>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              <X className="size-4" strokeWidth={1.8} />
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-secondary/40",
        pending && "opacity-60",
      )}
    >
      <Swatch hex={color.hex} muted={!color.isActive} />

      <span className="min-w-40 flex-1">
        <span className="block text-sm font-medium">{color.name}</span>
        <span className="block text-xs uppercase text-muted-foreground">
          {color.hex}
          {color.variantCount > 0 &&
            ` · ${color.variantCount} variant${color.variantCount === 1 ? "" : "s"}`}
        </span>
      </span>

      <span className="text-xs tabular-nums text-muted-foreground">
        #{color.sortOrder}
      </span>

      <StatusBadge status={color.isActive ? "ACTIVE" : "INACTIVE"} />

      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={pending}
          aria-label={`Edit ${color.name}`}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Pencil className="size-4" strokeWidth={1.8} />
        </button>

        <button
          type="button"
          onClick={() => run(() => toggleColor(color.id), "Updated")}
          disabled={pending}
          className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {color.isActive ? "Deactivate" : "Activate"}
        </button>

        <button
          type="button"
          onClick={() => run(() => deleteColor(color.id), "Deleted")}
          disabled={pending}
          aria-label={`Delete ${color.name}`}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" strokeWidth={1.8} />
        </button>
      </span>
    </li>
  );
}

export function ColorManager({ colors }: { colors: ColorRow[] }) {
  return (
    <div className="space-y-6">
      <Panel
        title="Add a colour"
        description="Colours are shared across every product variant."
      >
        <AddColorForm />
      </Panel>

      <Panel
        title="Colours"
        description={`${colors.length} colour${colors.length === 1 ? "" : "s"} in this store.`}
      >
        {colors.length === 0 ? (
          <EmptyState
            title="No colours yet"
            description="Add your first colour above — product variants pick from this list."
          />
        ) : (
          <ul className="divide-y divide-border">
            {colors.map((c) => (
              <ColorListRow key={c.id} color={c} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
