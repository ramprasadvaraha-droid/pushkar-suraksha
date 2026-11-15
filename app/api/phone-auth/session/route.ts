import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getFirebaseAdminAuth,
  isPhoneAuthEnabled,
  isPhoneAuthOriginAllowed,
  PhoneAuthRequestError,
  phoneSessionCookieName,
  phoneSessionDurationMs,
  verifyPhoneIdToken,
  verifyPhoneSessionCookie,
} from "@/lib/auth/firebase-server";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  if (!isPhoneAuthEnabled()) {
    return NextResponse.json({ user: null }, { headers: noStore });
  }

  const sessionCookie = (await cookies()).get(phoneSessionCookieName)?.value;
  if (!sessionCookie) return NextResponse.json({ user: null }, { headers: noStore });

  try {
    const { decoded, phoneNumber } = await verifyPhoneSessionCookie(sessionCookie);
    return NextResponse.json(
      {
        user: {
          id: `firebase:${decoded.uid}`,
          name: decoded.name || phoneNumber,
          phoneNumber,
          phoneNumberVerified: true,
        },
      },
      { headers: noStore },
    );
  } catch (error) {
    console.error("Firebase phone session verification failed.", error);
    const response = NextResponse.json({ user: null }, { status: 401, headers: noStore });
    response.cookies.set(phoneSessionCookieName, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  }
}

export async function POST(request: Request) {
  if (!isPhoneAuthEnabled()) {
    return NextResponse.json({ error: "Phone sign-in is not enabled." }, { status: 503 });
  }
  if (!isPhoneAuthOriginAllowed(request.headers.get("origin"))) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  let body: { idToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Sign-in details could not be read." }, { status: 400 });
  }
  if (typeof body.idToken !== "string" || body.idToken.length > 8192) {
    return NextResponse.json({ error: "Phone sign-in could not be verified." }, { status: 400 });
  }

  try {
    const { decoded, phoneNumber } = await verifyPhoneIdToken(body.idToken, {
      requirePasswordEmail: true,
      requireRecentAuth: true,
    });
    const sessionCookie = await getFirebaseAdminAuth().createSessionCookie(body.idToken, {
      expiresIn: phoneSessionDurationMs,
    });
    const response = NextResponse.json(
      {
        user: {
          id: `firebase:${decoded.uid}`,
          name: decoded.name || phoneNumber,
          phoneNumber,
          phoneNumberVerified: true,
        },
      },
      { headers: noStore },
    );
    response.cookies.set(phoneSessionCookieName, sessionCookie, {
      httpOnly: true,
      maxAge: Math.floor(phoneSessionDurationMs / 1000),
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    if (error instanceof PhoneAuthRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
    }
    console.error("Firebase phone session creation failed.", error);
    return NextResponse.json({ error: "Could not complete phone sign-in." }, { status: 401, headers: noStore });
  }
}

export async function DELETE(request: Request) {
  if (!isPhoneAuthEnabled()) {
    return NextResponse.json({ status: "signed_out" }, { headers: noStore });
  }
  if (!isPhoneAuthOriginAllowed(request.headers.get("origin"))) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const response = NextResponse.json({ status: "signed_out" }, { headers: noStore });
  response.cookies.set(phoneSessionCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
