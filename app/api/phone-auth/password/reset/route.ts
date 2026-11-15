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
    return NextResponse.json({ error: "Phone password reset is not enabled." }, { status: 503 });
  }
  if (!isPhoneAuthOriginAllowed(request.headers.get("origin"))) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  let body: { idToken?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Password reset details could not be read." }, { status: 400 });
  }
  if (typeof body.idToken !== "string" || body.idToken.length > 8192) {
    return NextResponse.json({ error: "Phone verification could not be confirmed." }, { status: 400 });
  }
  if (typeof body.newPassword !== "string" || body.newPassword.length < 8 || body.newPassword.length > 128) {
    return NextResponse.json({ error: "Password must be 8 to 128 characters." }, { status: 400 });
  }

  try {
    const { decoded, email, phoneNumber } = await verifyPhoneIdToken(body.idToken, {
      requirePhoneProvider: true,
      requireRecentAuth: true,
    });
    const auth = getFirebaseAdminAuth();
    const user = await auth.getUser(decoded.uid);
    if (user.phoneNumber !== phoneNumber || user.email !== email) {
      return NextResponse.json({ error: "No phone account was found for this number." }, { status: 404 });
    }

    await auth.updateUser(decoded.uid, { password: body.newPassword });
    return NextResponse.json(
      { status: "password_reset" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PhoneAuthRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Firebase phone password reset failed.", error);
    return NextResponse.json({ error: "Could not reset the phone account password." }, { status: 500 });
  }
}
