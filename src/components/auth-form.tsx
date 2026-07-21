"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { login, register } from "@/actions/auth";
import { initialFormState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action, pending] = useActionState(login, initialFormState);

  return (
    <form action={action} className="space-y-5">
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      {state.message && (
        <p
          role="alert"
          className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        errors={state.errors?.email}
        required
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        errors={state.errors?.password}
        required
      />

      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full rounded-none">
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/register" className="link-wipe text-foreground">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, initialFormState);

  return (
    <form action={action} className="space-y-5">
      {state.message && (
        <p
          role="alert"
          className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      <Field name="name" label="Full name" autoComplete="name" errors={state.errors?.name} required />
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        errors={state.errors?.email}
        required
      />
      <Field name="phone" label="Phone (optional)" type="tel" autoComplete="tel" errors={state.errors?.phone} />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        errors={state.errors?.password}
        required
      />
      <Field
        name="passwordConfirm"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        errors={state.errors?.passwordConfirm}
        required
      />

      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full rounded-none">
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="link-wipe text-foreground">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({
  name,
  label,
  hint,
  errors,
  ...props
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `field-${name}`;
  const describedBy = errors ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="kicker text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "mt-1.5 h-11 w-full border bg-background px-3 text-sm outline-none transition-colors",
          errors ? "border-destructive" : "border-border focus:border-foreground",
        )}
        {...props}
      />
      {errors ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {errors[0]}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
