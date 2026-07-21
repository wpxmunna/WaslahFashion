"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  createExpenseCategory,
  deleteExpenseCategory,
  updateExpenseCategory,
} from "@/actions/admin/expenses";
import { initialFormState } from "@/actions/types";
import { DeleteButton } from "@/components/admin/delete-button";
import {
  CheckboxField,
  FormMessage,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { EmptyState, Panel, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/slug";

export type ExpenseCategoryRow = {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  icon: string;
  isActive: boolean;
  expenseCount: number;
};

/** Shared field block so the add and edit forms cannot drift apart. */
function CategoryFields({
  values,
  errors,
}: {
  values?: Partial<ExpenseCategoryRow>;
  errors: Record<string, string[]>;
}) {
  const [slug, setSlug] = useState(values?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(values?.slug));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        name="name"
        label="Name"
        required
        maxLength={100}
        defaultValue={values?.name ?? ""}
        errors={errors.name}
        onChange={(ev) => {
          if (!slugTouched) setSlug(slugify(ev.target.value));
        }}
      />
      <TextField
        name="slug"
        label="Slug"
        maxLength={100}
        hint="Generated from the name."
        value={slug}
        errors={errors.slug}
        onChange={(ev) => {
          setSlugTouched(true);
          setSlug(ev.target.value);
        }}
      />
      <TextField
        name="color"
        label="Colour"
        type="color"
        defaultValue={values?.color ?? "#6c757d"}
        errors={errors.color}
      />
      <TextField
        name="icon"
        label="Icon"
        maxLength={50}
        placeholder="tag"
        defaultValue={values?.icon ?? "tag"}
        errors={errors.icon}
      />
      <TextareaField
        name="description"
        label="Description"
        rows={2}
        defaultValue={values?.description ?? ""}
        errors={errors.description}
        className="sm:col-span-2"
      />
      <div className="sm:col-span-2">
        <CheckboxField
          name="isActive"
          label="Active"
          hint="Inactive categories stay on their existing expenses but are not offered for new ones."
          defaultChecked={values?.isActive ?? true}
        />
      </div>
    </div>
  );
}

function AddCategoryForm() {
  const [state, formAction] = useActionState(createExpenseCategory, initialFormState);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Collapsing the form is an adjustment to a new action result, so it happens
  // during render rather than in an effect.
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.ok) setOpen(false);
  }

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Category added");
      formRef.current?.reset();
    }
  }, [state]);

  if (!open) {
    return (
      <div className="border-b border-border p-4">
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="size-4" strokeWidth={2} />
          New category
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4 border-b border-border p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base">New category</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel adding a category"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
        >
          <X className="size-4" strokeWidth={1.8} />
        </button>
      </div>

      {state.message && !state.ok && <FormMessage state={state} />}

      <CategoryFields errors={state.errors ?? {}} />

      <div className="flex justify-end">
        <SubmitButton>Add category</SubmitButton>
      </div>
    </form>
  );
}

function CategoryRow({ category }: { category: ExpenseCategoryRow }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(
    updateExpenseCategory.bind(null, category.id),
    initialFormState,
  );

  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.ok) setEditing(false);
  }

  useEffect(() => {
    if (state.ok) toast.success(state.message ?? "Category saved");
  }, [state]);

  if (editing) {
    return (
      <li>
        <form action={formAction} className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base">Edit {category.name}</h3>
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label="Cancel editing"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
            >
              <X className="size-4" strokeWidth={1.8} />
            </button>
          </div>

          {state.message && !state.ok && <FormMessage state={state} />}

          <CategoryFields values={category} errors={state.errors ?? {}} />

          <div className="flex justify-end">
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4">
      <span
        aria-hidden
        className="size-4 shrink-0 rounded-full border border-border"
        style={{ backgroundColor: category.color }}
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{category.name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {category.slug} · {category.expenseCount} expense
          {category.expenseCount === 1 ? "" : "s"}
          {category.description && ` · ${category.description}`}
        </span>
      </span>

      <StatusBadge status={category.isActive ? "ACTIVE" : "INACTIVE"} />

      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
        >
          <Pencil className="size-3.5" strokeWidth={1.8} />
          Edit
        </button>
        <DeleteButton
          id={category.id}
          action={deleteExpenseCategory}
          label="Delete"
          confirmTitle={`Delete ${category.name}?`}
          confirmBody={
            category.expenseCount > 0
              ? `${category.expenseCount} expense${
                  category.expenseCount === 1 ? "" : "s"
                } will be moved to uncategorised. The expenses themselves are kept.`
              : "This cannot be undone."
          }
        />
      </span>
    </li>
  );
}

export function ExpenseCategoriesManager({
  categories,
}: {
  categories: ExpenseCategoryRow[];
}) {
  return (
    <Panel
      title="Categories"
      description="Used to group expenses in reports and on the expense list."
    >
      <AddCategoryForm />

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Add a category to start grouping your expenses."
        />
      ) : (
        <ul className="divide-y divide-border">
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
