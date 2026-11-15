import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/server";
import {
  isPhoneAuthEnabled,
  phoneSessionCookieName,
  verifyPhoneSessionCookie,
} from "@/lib/auth/firebase-server";

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
  try {
    if (isPhoneAuthEnabled()) {
      try {
        const sessionCookie = (await cookies()).get(phoneSessionCookieName)?.value;
        if (sessionCookie) {
          const { decoded, phoneNumber } = await verifyPhoneSessionCookie(sessionCookie);
          return {
            id: `firebase:${decoded.uid}`,
            name: decoded.name || phoneNumber,
            email: null,
            emailVerified: false,
            phoneNumber,
            phoneNumberVerified: true,
          };
        }
      } catch (error) {
        console.error("Firebase phone session lookup failed.", error);
      }
    }
    const { data, error } = await auth.getSession();
    if (error) {
      console.error("Neon Auth session lookup failed.", error);
      return null;
    }
    const user = data?.user;
    if (!user || user.emailVerified !== true) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      phoneNumber: null,
      phoneNumberVerified: false,
    };
  } catch (error) {
    console.error("Neon Auth session lookup failed.", error);
    return null;
  }
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

