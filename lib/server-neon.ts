import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";

export function isServerConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.AWS_ENDPOINT_URL_S3 &&
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY,
  );
}

export async function getAuthenticatedUser() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session?.user;
    if (!user || (!user.emailVerified && !user.phoneNumberVerified)) return null;
    return user;
  } catch (error) {
    console.error("Better Auth session lookup failed.", error);
    return null;
  }
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

