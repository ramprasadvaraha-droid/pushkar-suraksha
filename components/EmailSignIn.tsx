"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { PasswordResetForm } from "@/components/PasswordResetForm";
import { useLanguage } from "@/lib/i18n";

export function EmailSignIn({
  onAuthenticated,
  title,
  allowPassword = false,
}: {
  onAuthenticated: (email: string) => void;
  title?: string;
  allowPassword?: boolean;
}) {
  const { t } = useLanguage();
  const signInTitle = title ?? t("Family sign-in");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<"otp" | "password" | "reset">(allowPassword ? "password" : "otp");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "sign-in",
      });
      if (sendError) throw new Error(sendError.message ?? "Could not send the sign-in code.");
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the sign-in code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: signInError } = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: otp.trim(),
      });
      if (signInError) throw new Error(signInError.message ?? "Could not verify the sign-in code.");
      onAuthenticated(email.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify the sign-in code.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (signInError) throw new Error(signInError.message ?? "Could not sign in with that password.");
      onAuthenticated(email.trim());
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not sign in with that password.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "reset") {
    return (
      <PasswordResetForm
        initialEmail={email}
        onCancel={() => setMode("password")}
        onComplete={(resetEmail) => {
          setEmail(resetEmail);
          setMode("password");
          setPassword("");
          setNotice("Password set. Use it for future sign-ins.");
        }}
      />
    );
  }

  return (
    <form className="pin-panel" onSubmit={(event) => {
      if (mode === "password") void signInWithPassword(event);
      else if (sent) void verifyCode(event);
      else void sendCode(event);
    }}>
      <h2>{mode === "password" ? signInTitle : sent ? t("Enter your email code") : signInTitle}</h2>
      {sent && <p>{t("A one-time code was sent to {email}.", { email: email.trim() })}</p>}
      {mode === "password" && notice && <div className="alert alert-info" role="status">{t(notice)}</div>}
      {mode === "password" || !sent ? (
        <label className="field">
          <span>{t("Email address")}</span>
          <input
            required
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
      ) : (
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
      )}
      {mode === "password" && (
        <label className="field">
          <span>{t("Password")}</span>
          <input
            required
            type="password"
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      )}
      {error && <div className="field-error" role="alert">{t(error)}</div>}
      <div className="pin-row">
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? t("Please wait...") : mode === "password" ? t("Sign in") : sent ? t("Verify & sign in") : t("Send sign-in code")}
        </button>
        {mode === "otp" && sent && <button className="text-button" type="button" disabled={busy} onClick={() => { setSent(false); setOtp(""); setError(""); }}>{t("Change email")}</button>}
      </div>
      {allowPassword && (
        <div className="sign-in-options">
          {mode === "password" ? (
            <>
              <button className="text-button" type="button" disabled={busy} onClick={() => { setMode("reset"); setError(""); setNotice(""); }}>{t("Set or reset password")}</button>
              <button className="text-button" type="button" disabled={busy} onClick={() => { setMode("otp"); setSent(false); setOtp(""); setError(""); setNotice(""); }}>{t("Use email code")}</button>
            </>
          ) : (
            <button className="text-button" type="button" disabled={busy} onClick={() => { setMode("password"); setSent(false); setOtp(""); setError(""); }}>{t("Use password")}</button>
          )}
        </div>
      )}
    </form>
  );
}
