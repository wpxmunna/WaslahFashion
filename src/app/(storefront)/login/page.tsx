import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  if (await getSession()) redirect("/account");

  const raw = await searchParams;
  const target = Array.isArray(raw.redirectTo) ? raw.redirectTo[0] : raw.redirectTo;
  // Only same-origin relative paths survive; the action re-checks this too.
  const redirectTo = target?.startsWith("/") && !target.startsWith("//") ? target : undefined;

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <h1 className="font-display text-4xl">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Sign in to your account.</p>
      <div className="mt-10">
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
