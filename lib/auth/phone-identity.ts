export function normalizeIndianPhone(value: string): string | null {
  const digits = value.trim().replace(/\D/g, "");
  const nationalNumber = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(nationalNumber) ? `+91${nationalNumber}` : null;
}

export async function phonePasswordEmail(phoneNumber: string): Promise<string> {
  if (normalizeIndianPhone(phoneNumber) !== phoneNumber) {
    throw new Error("A normalized Indian phone number is required.");
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(phoneNumber),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `phone-${hash}@accounts.pushkar.invalid`;
}
