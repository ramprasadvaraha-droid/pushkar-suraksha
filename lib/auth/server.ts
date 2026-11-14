import { createNeonAuth } from "@neon/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

if (!baseUrl) throw new Error("Set NEON_AUTH_BASE_URL to the linked branch's Neon Auth URL.");
if (!cookieSecret || cookieSecret.length < 32) {
  throw new Error("Set NEON_AUTH_COOKIE_SECRET to a secret containing at least 32 characters.");
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: { secret: cookieSecret },
});
