const MSG91_OTP_URL = "https://control.msg91.com/api/v5/otp";
const MSG91_VERIFY_URL = "https://control.msg91.com/api/v5/otp/verify";

function getMsg91Config() {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  if (!authKey || !templateId) {
    throw new Error("Phone sign-in is not configured. Set MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID.");
  }
  return { authKey, templateId };
}

function toMsg91Mobile(phoneNumber: string) {
  return phoneNumber.replace(/\D/g, "");
}

export async function sendMsg91Otp(phoneNumber: string) {
  const { authKey, templateId } = getMsg91Config();
  const url = new URL(MSG91_OTP_URL);
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", toMsg91Mobile(phoneNumber));
  url.searchParams.set("authkey", authKey);

  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const result = await response.json() as { type?: string; message?: string };
  if (!response.ok || result.type !== "success") {
    throw new Error(result.message ?? "MSG91 could not send a verification code.");
  }
}

export async function verifyMsg91Otp(phoneNumber: string, code: string) {
  const { authKey } = getMsg91Config();
  const url = new URL(MSG91_VERIFY_URL);
  url.searchParams.set("otp", code);
  url.searchParams.set("mobile", toMsg91Mobile(phoneNumber));

  const response = await fetch(url, {
    headers: { Accept: "application/json", authkey: authKey },
  });
  const result = await response.json() as { type?: string };
  return response.ok && result.type === "success";
}
