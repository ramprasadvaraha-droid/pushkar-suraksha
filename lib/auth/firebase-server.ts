import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { normalizeIndianPhone, phonePasswordEmail } from "@/lib/auth/phone-identity";

export const phoneSessionCookieName = "pushkar_phone_session";
export const phoneSessionDurationMs = 5 * 24 * 60 * 60 * 1000;

export class PhoneAuthRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PhoneAuthRequestError";
  }
}

export function isPhoneAuthEnabled(): boolean {
  return process.env.PHONE_AUTH_ENABLED === "true" && configuredTestNumbers().size > 0;
}

export function isPhoneTestNumberAllowed(phoneNumber: string): boolean {
  return configuredTestNumbers().has(phoneNumber);
}

export function isPhoneAuthOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  try {
    return trustedOrigins().has(new URL(origin).origin) && new URL(origin).origin === origin;
  } catch {
    return false;
  }
}

export function getFirebaseAdminAuth() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are not configured.");
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== projectId) {
    throw new Error("Firebase client and Admin project IDs must match.");
  }

  const appName = "pushkar-suraksha-phone-auth-admin";
  const app = getApps().find((candidate) => candidate.name === appName)
    ?? initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    }, appName);
  return getAuth(app);
}

export async function verifyPhoneIdToken(
  idToken: string,
  options: { requireRecentAuth?: boolean; requirePhoneProvider?: boolean; requirePasswordEmail?: boolean } = {},
) {
  const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
  if (options.requireRecentAuth) assertRecentAuthentication(decoded);
  if (options.requirePhoneProvider && decoded.firebase.sign_in_provider !== "phone") {
    throw new PhoneAuthRequestError(401, "A recently verified phone number is required.");
  }

  const phoneNumber = normalizeIndianPhone(decoded.phone_number ?? "");
  if (!phoneNumber) throw new PhoneAuthRequestError(401, "A verified Indian phone number is required.");
  if (!isPhoneTestNumberAllowed(phoneNumber)) {
    throw new PhoneAuthRequestError(403, "This phone number is not enabled for test sign-in.");
  }

  const email = await phonePasswordEmail(phoneNumber);
  if (options.requirePasswordEmail && decoded.email !== email) {
    throw new PhoneAuthRequestError(401, "This phone account is not registered.");
  }
  return { decoded, email, phoneNumber };
}

export async function verifyPhoneSessionCookie(sessionCookie: string) {
  const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
  const phoneNumber = normalizeIndianPhone(decoded.phone_number ?? "");
  if (!phoneNumber || !isPhoneTestNumberAllowed(phoneNumber)) {
    throw new PhoneAuthRequestError(401, "The phone session is invalid.");
  }

  const email = await phonePasswordEmail(phoneNumber);
  if (decoded.email !== email) {
    throw new PhoneAuthRequestError(401, "The phone account is not fully configured.");
  }
  return { decoded, email, phoneNumber };
}

function configuredTestNumbers(): Set<string> {
  const numbers = (process.env.NEXT_PUBLIC_PHONE_AUTH_TEST_NUMBERS ?? "")
    .split(",")
    .map((value) => normalizeIndianPhone(value))
    .filter((value): value is string => value !== null);
  return new Set(numbers);
}

function trustedOrigins(): Set<string> {
  const values = [
    process.env.PHONE_AUTH_BASE_URL ?? "http://localhost:3000",
    ...(process.env.PHONE_AUTH_TRUSTED_ORIGINS ?? "").split(","),
  ].filter((value) => value.trim());
  return new Set(values.map((value) => new URL(value.trim()).origin));
}

function assertRecentAuthentication(decoded: DecodedIdToken): void {
  const ageSeconds = Date.now() / 1000 - decoded.auth_time;
  if (ageSeconds < 0 || ageSeconds > 5 * 60) {
    throw new PhoneAuthRequestError(401, "Please verify your phone number again.");
  }
}
