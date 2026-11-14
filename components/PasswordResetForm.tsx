"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { useLanguage } from "@/lib/i18n";

export function PasswordResetForm({
  initialEmail,
  allowEmailChange = true,
  onCancel,
  onComplete,
}: {
  initialEmail: string;
  allowEmailChange?: boolean;
  onCancel?: () => void;
  onComplete?: (email: string) => void;
}) {
  const { t } = useLanguage();
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function requestCode() {
    setError("");
    setBusy(true);
    try {
      const { error: sendError } = await authClient.forgetPassword.emailOtp({
        email: email.trim(),
      });
      if (sendError) throw new Error(sendError.message ?? "Could not send the password code.");
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not send the password code.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestCode();
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error: resetError } = await authClient.emailOtp.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        password,
      });
      if (resetError) throw new Error(resetError.message ?? "Could not set the password.");
      setSuccess(true);
      onComplete?.(email.trim());
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not set the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pin-panel password-reset-panel">
      <h2>{t("Set or reset password")}</h2>
      <p>{t("Verify your email with a code, then choose a password for future sign-ins.")}</p>
      {!sent ? (
        <form onSubmit={(event) => void sendCode(event)}>
          <label className="field">
            <span>{t("Email address")}</span>
            <input
              required
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              readOnly={!allowEmailChange}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          {error && <div className="field-error" role="alert">{t(error)}</div>}
          <div className="pin-row">
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? t("Please wait...") : t("Send password code")}
            </button>
            {onCancel && <button className="text-button" type="button" disabled={busy} onClick={onCancel}>{t("Cancel")}</button>}
          </div>
        </form>
      ) : success ? (
        <div className="alert alert-info" role="status">{t("Password set. Use it for future sign-ins.")}</div>
      ) : (
        <form onSubmit={(event) => void resetPassword(event)}>
          <p>{t("A password code was sent to {email}.", { email: email.trim() })}</p>
          <label className="field">
            <span>{t("One-time code")}</span>
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
            />
          </label>
          <label className="field">
            <span>{t("New password")} <small>{t("8–128 characters")}</small></span>
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="field">
            <span>{t("Confirm new password")}</span>
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          {error && <div className="field-error" role="alert">{t(error)}</div>}
          <div className="pin-row">
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? t("Please wait...") : t("Set password")}
            </button>
            <button className="text-button" type="button" disabled={busy} onClick={() => { setOtp(""); setPassword(""); setConfirmPassword(""); void requestCode(); }}>
              {t("Resend code")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
