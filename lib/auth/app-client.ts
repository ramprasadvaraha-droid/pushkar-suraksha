"use client";

import { authClient } from "@/lib/auth/client";

export const phoneAuthEnabled =
  process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_PHONE_AUTH_TEST_NUMBERS);

export interface AppAuthUser {
  id: string;
  name: string;
  email?: string;
  emailVerified: boolean;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean;
}

export async function getAppAuthUser(): Promise<AppAuthUser | null> {
  if (phoneAuthEnabled) {
    const response = await fetch("/api/phone-auth/session", { cache: "no-store" });
    if (response.status !== 401 && !response.ok) {
      throw new Error("Could not restore your phone sign-in.");
    }
    const result = await response.json() as {
      user?: { id: string; name: string; phoneNumber: string; phoneNumberVerified: boolean } | null;
    };
    if (result.user?.phoneNumberVerified) {
      return {
        id: result.user.id,
        name: result.user.name,
        emailVerified: false,
        phoneNumber: result.user.phoneNumber,
        phoneNumberVerified: true,
      };
    }
  }

  const managedSession = await authClient.getSession();
  if (managedSession.error) throw new Error(managedSession.error.message ?? "Could not restore your sign-in.");
  const user = managedSession.data?.user;
  if (!user?.emailVerified) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
  };
}

export async function clearPhoneSession(): Promise<void> {
  if (!phoneAuthEnabled) return;
  const response = await fetch("/api/phone-auth/session", { method: "DELETE" });
  if (!response.ok) throw new Error("Could not clear the phone sign-in session.");
}

export async function signOutApp() {
  let phoneError: string | null = null;
  try {
    await clearPhoneSession();
  } catch (error) {
    phoneError = error instanceof Error ? error.message : "Could not clear the phone sign-in session.";
  }
  const managedResult = await authClient.signOut();
  return {
    error: phoneError
      ? { message: phoneError }
      : managedResult.error
        ? { message: managedResult.error.message ?? "Could not sign out." }
        : null,
  };
}
