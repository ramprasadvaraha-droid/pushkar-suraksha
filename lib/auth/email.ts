import nodemailer from "nodemailer";

type EmailOtpPurpose = "sign-in" | "email-verification" | "forget-password" | "change-email";

const emailPurpose: Record<EmailOtpPurpose, string> = {
  "sign-in": "sign-in",
  "email-verification": "email verification",
  "forget-password": "password reset",
  "change-email": "email change",
};

function getEmailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password) {
    throw new Error("Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
  });
}

function getSender() {
  const from = process.env.SMTP_FROM;
  if (!from) throw new Error("Email delivery is not configured. Set SMTP_FROM.");
  return from;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendAuthEmailOtp(email: string, otp: string, type: EmailOtpPurpose) {
  const purpose = emailPurpose[type];
  await getEmailTransport().sendMail({
    from: getSender(),
    to: email,
    subject: `Pushkar Suraksha ${purpose} code`,
    text: `Your Pushkar Suraksha ${purpose} code is ${otp}. Do not share this code with anyone.`,
  });
}

export async function sendEmailVerificationLink(email: string, url: string) {
  const safeUrl = escapeHtml(url);
  await getEmailTransport().sendMail({
    from: getSender(),
    to: email,
    subject: "Verify your Pushkar Suraksha email",
    text: `Verify your email address by opening this link: ${url}`,
    html: `<p>Verify your Pushkar Suraksha email address:</p><p><a href="${safeUrl}">Verify email</a></p>`,
  });
}
