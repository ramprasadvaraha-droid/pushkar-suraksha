import { betterAuth } from "better-auth";
import { emailOTP, phoneNumber } from "better-auth/plugins";
import { sendAuthEmailOtp, sendEmailVerificationLink } from "@/lib/auth/email";
import { sendMsg91Otp, verifyMsg91Otp } from "@/lib/auth/msg91";
import { getPool } from "@/lib/db";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("Better Auth requires BETTER_AUTH_SECRET to contain at least 32 characters.");
}

const deploymentURL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const baseURL = process.env.BETTER_AUTH_URL ?? deploymentURL ?? "http://localhost:3000";
if (
  process.env.NODE_ENV === "production" &&
  process.env.VERCEL_ENV !== "preview" &&
  !process.env.BETTER_AUTH_URL
) {
  throw new Error("Set BETTER_AUTH_URL to the public application URL in production.");
}

export const auth = betterAuth({
  database: getPool(),
  secret,
  baseURL,
  trustedOrigins: [...new Set([baseURL, deploymentURL].filter((origin): origin is string => Boolean(origin)))],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmailVerificationLink(user.email, url);
    },
  },
  plugins: [
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendAuthEmailOtp(email, otp, type);
      },
    }),
    phoneNumber({
      requireVerification: true,
      phoneNumberValidator: (phone) => /^\+91[6-9]\d{9}$/.test(phone),
      sendOTP: async ({ phoneNumber: phone }) => {
        await sendMsg91Otp(phone);
      },
      verifyOTP: async ({ phoneNumber: phone, code }) => verifyMsg91Otp(phone, code),
      signUpOnVerification: {
        getTempEmail: (phone) =>
          `phone-${phone.replace(/\D/g, "")}@accounts.pushkar-suraksha.invalid`,
        getTempName: () => "Pushkar family",
      },
    }),
  ],
});
