import { NextResponse } from "next/server";
import {
  getFirebaseAdminAuth,
  isPhoneAuthEnabled,
  isPhoneAuthOriginAllowed,
  PhoneAuthRequestError,
  verifyPhoneIdToken,
} from "@/lib/auth/firebase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isPhoneAuthEnabled()) {
    return NextResponse.json({ error: "Phone sign-up is not enabled." }, { status: 503 });
  }
  if (!isPhoneAuthOriginAllowed(request.headers.get("origin"))) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  let body: { idToken?: unknown; name?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Account details could not be read." }, { status: 400 });
  }
  if (typeof body.idToken !== "string" || body.idToken.length > 8192) {
    return NextResponse.json({ error: "Phone verification could not be confirmed." }, { status: 400 });
  }
  if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 100) {
    return NextResponse.json({ error: "Name must be 2 to 100 characters." }, { status: 400 });
  }
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) {
    return NextResponse.json({ error: "Password must be 8 to 128 characters." }, { status: 400 });
  }

  try {
    const { decoded, email, phoneNumber } = await verifyPhoneIdToken(body.idToken, {
      requirePhoneProvider: true,
      requireRecentAuth: true,
    });
    const auth = getFirebaseAdminAuth();
    const user = await auth.getUser(decoded.uid);
    if (user.phoneNumber !== phoneNumber || user.email) {
      return NextResponse.json({ error: "This mobile number already has an account. Sign in instead." }, { status: 409 });
    }

    await auth.updateUser(decoded.uid, {
      displayName: body.name.trim(),
      email,
      password: body.password,
    });
    return NextResponse.json(
      { status: "account_created" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PhoneAuthRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/email-already-exists") {
      return NextResponse.json({ error: "This mobile number already has an account. Sign in instead." }, { status: 409 });
    }
    console.error("Firebase phone account creation failed.", error);
    return NextResponse.json({ error: "Could not create the phone account." }, { status: 500 });
  }
}
