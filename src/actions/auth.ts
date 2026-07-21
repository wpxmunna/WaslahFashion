"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { mergeGuestCartIntoUser } from "@/lib/cart";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "./types";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  redirectTo: z.string().optional(),
});

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your name"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
    phone: z.string().trim().optional(),
    password: z.string().min(8, "Use at least 8 characters"),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });

/** Only same-origin relative paths, so `?redirectTo=` can't become an open redirect. */
function safeRedirect(target: string | undefined, fallback: string): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  return target;
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(z.flattenError(parsed.error).fieldErrors);

  const { email, password, redirectTo } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, passwordHash: true, role: true, isActive: true },
  });

  // Same message whether the account is missing, deactivated, or the password
  // is wrong — do not leak which emails are registered.
  const valid = user?.isActive ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    return { ok: false, message: "Incorrect email or password." };
  }

  await createSession({ userId: user.id, role: user.role });
  await mergeGuestCartIntoUser(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  revalidatePath("/", "layout");
  redirect(safeRedirect(redirectTo, user.role === "CUSTOMER" ? "/account" : "/admin"));
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(z.flattenError(parsed.error).fieldErrors);

  const { name, email, phone, password } = parsed.data;
  const normalisedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalisedEmail },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, errors: { email: ["An account with this email already exists"] } };
  }

  const user = await prisma.user.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      name,
      email: normalisedEmail,
      phone: phone || null,
      passwordHash: await hashPassword(password),
      role: "CUSTOMER",
    },
    select: { id: true, role: true },
  });

  await createSession({ userId: user.id, role: user.role });
  await mergeGuestCartIntoUser(user.id);

  revalidatePath("/", "layout");
  redirect("/account");
}

/**
 * Clear the session. The caller navigates.
 *
 * This deliberately does not `redirect()`. A `redirect()` inside a server
 * action throws a NEXT_REDIRECT signal that only gets handled when the action
 * runs inside a form action or a transition — invoked as a bare promise from
 * an event handler, the signal is swallowed and the user stays on a page that
 * still looks signed in.
 */
export async function logout(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
}
