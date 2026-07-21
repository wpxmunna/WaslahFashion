import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";

import { prisma } from "./prisma";
import type { UserRole } from "@/generated/prisma";

const SESSION_COOKIE = "waslah_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Legacy used bcrypt cost 12 in `Auth` but the PHP default (10) in
 * `UserController::changePassword` — standardise on 12 everywhere.
 */
const BCRYPT_COST = 12;

export type SessionPayload = {
  userId: number;
  role: UserRole;
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(value);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

/** Issue the session cookie. Call from a Server Action or Route Handler. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Decode the session cookie. Deduped per request so repeated calls across a
 * page's component tree hit the cookie/JWT once.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = Number(payload.sub);
    const role = payload.role as UserRole | undefined;
    if (!Number.isInteger(userId) || userId <= 0 || !role) return null;
    return { userId, role };
  } catch {
    // Expired or tampered token — treat as logged out.
    return null;
  }
});

/**
 * The signed-in user, or null. Re-reads the row so a deactivated account loses
 * access immediately rather than at token expiry.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user || !user.isActive) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function isStaff(role: UserRole): boolean {
  return role === "ADMIN" || role === "MANAGER";
}
