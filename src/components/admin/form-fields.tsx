"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------
   Shared admin form primitives. Every admin form composes these so validation
   display, spacing and accessibility wiring stay consistent.
   ------------------------------------------------------------------------- */

const controlClass =
  "mt-1.5 w-full rounded-md border bg-background px-3 py-2.5 text-sm outline-none transition-[color,box-shadow,border-color] focus:ring-2";

function stateClass(hasError: boolean) {
  return hasError
    ? "border-destructive focus:border-destructive focus:ring-destructive/15"
    : "border-border focus:border-primary focus:ring-primary/15";
}

export function Field({
  name,
  label,
  hint,
  errors,
  required,
  className,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const id = `f-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {errors?.length ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {errors[0]}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  name,
  label,
  hint,
  errors,
  required,
  className,
  adornment,
  ...props
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  className?: string;
  /** Trailing control inside the field — e.g. a native colour picker. */
  adornment?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${name}`;

  const input = (
    <input
      id={id}
      name={name}
      required={required}
      aria-invalid={errors?.length ? true : undefined}
      aria-describedby={errors?.length ? `${id}-error` : undefined}
      className={cn(
        controlClass,
        stateClass(!!errors?.length),
        adornment && "pr-12",
      )}
      {...props}
    />
  );

  return (
    <Field
      name={name}
      label={label}
      hint={hint}
      errors={errors}
      required={required}
      className={className}
    >
      {adornment ? (
        <div className="relative">
          {input}
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{adornment}</span>
        </div>
      ) : (
        input
      )}
    </Field>
  );
}

export function TextareaField({
  name,
  label,
  hint,
  errors,
  required,
  className,
  rows = 4,
  ...props
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = `f-${name}`;
  return (
    <Field
      name={name}
      label={label}
      hint={hint}
      errors={errors}
      required={required}
      className={className}
    >
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        aria-invalid={errors?.length ? true : undefined}
        className={cn(controlClass, "resize-y", stateClass(!!errors?.length))}
        {...props}
      />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  errors,
  required,
  className,
  options,
  placeholder,
  ...props
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  className?: string;
  placeholder?: string;
  options: { value: string | number; label: string }[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = `f-${name}`;
  return (
    <Field
      name={name}
      label={label}
      hint={hint}
      errors={errors}
      required={required}
      className={className}
    >
      <select
        id={id}
        name={name}
        required={required}
        aria-invalid={errors?.length ? true : undefined}
        className={cn(controlClass, stateClass(!!errors?.length))}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  errors,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  defaultChecked?: boolean;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={errors?.length ? `${id}-error` : undefined}
          className="mt-0.5 size-4 accent-[var(--primary)]"
        />
        <span>
          <span className="block text-sm font-medium">{label}</span>
          {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
        </span>
      </label>
      {errors?.length ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

/** Submit button that reflects the enclosing form's pending state. */
export function SubmitButton({
  children = "Save",
  className,
  disabled,
  ...props
}: { children?: ReactNode; className?: string } & React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();

  // `disabled` is combined with the pending state rather than spread over it —
  // spreading last let a caller-supplied `disabled={false}` re-enable the
  // button mid-submit, allowing double submission.
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      className={className}
      {...props}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; message?: string } }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cn(
        "rounded-md border p-3 text-sm",
        state.ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/40 bg-destructive/5 text-destructive",
      )}
    >
      {state.message}
    </p>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
      {children}
    </div>
  );
}
