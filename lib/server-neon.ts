import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

export function isServerConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL &&
    process.env.NEON_AUTH_BASE_URL &&
    process.env.NEON_AUTH_COOKIE_SECRET &&
    process.env.AWS_ENDPOINT_URL_S3 &&
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY,
  );
}

export async function getAuthenticatedUser() {
  const { data, error } = await auth.getSession();
  if (error) {
    console.error("Neon Auth session lookup failed.", error);
    return null;
  }
  return data?.user ?? null;
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

