import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getSession()) redirect("/account");

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <h1 className="font-display text-4xl">Create an account</h1>
      <p className="mt-2 text-muted-foreground">
        Save your addresses and track every order.
      </p>
      <div className="mt-10">
        <RegisterForm />
      </div>
    </div>
  );
}
