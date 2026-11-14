import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { auth } from "@/lib/auth/server";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";

export async function POST(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const origin = request.headers.get("origin");
  const allowedOrigins = [
    new URL(request.url).origin,
    process.env.BETTER_AUTH_URL,
    process.env.VERCEL_URL
      ? `${process.env.VERCEL_URL.startsWith("http") ? "" : "https://"}${process.env.VERCEL_URL}`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => new URL(value).origin);
  if (!origin || !allowedOrigins.includes(origin)) {
    return apiError("Request origin could not be verified.", 403);
  }

  const user = await getAuthenticatedUser();
  if (!user?.phoneNumberVerified) {
    return apiError("Verify your mobile number before setting a password.", 403);
  }

  let body: { newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Password details could not be read.");
  }
  if (typeof body.newPassword !== "string" || body.newPassword.length < 8 || body.newPassword.length > 128) {
    return apiError("Password must be between 8 and 128 characters.");
  }

  try {
    await auth.api.setPassword({
      headers: await headers(),
      body: { newPassword: body.newPassword },
    });
    return NextResponse.json({ status: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "PASSWORD_ALREADY_SET") {
      return NextResponse.json({ passwordAlreadySet: true }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    console.error("Volunteer password setup failed.", error);
    return apiError("Could not set your password.", 400);
  }
}
