"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { PasswordResetForm } from "@/components/PasswordResetForm";
import { useLanguage } from "@/lib/i18n";

export function EmailSignIn({
  onAuthenticated,
  title,
  allowPassword = false,
  allowSignUp = false,
}: {
  onAuthenticated: (email: string) => void;
  title?: string;
  allowPassword?: boolean;
  allowSignUp?: boolean;
}) {
  const { t } = useLanguage();
  const signInTitle = title ?? t("Family sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<"signup" | "verification" | "otp" | "password" | "reset">(
    allowSignUp ? "signup" : allowPassword ? "password" : "otp",
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function changeMode(nextMode: typeof mode) {
    setMode(nextMode);
    setSent(false);
    setOtp("");
    setError("");
    setNotice("");
  }

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

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const { data, error: signUpError } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (signUpError) throw new Error(signUpError.message ?? "Could not create account. Please try again.");
      if (!data?.user) throw new Error("Could not create account. Please try again.");
      const { data: sessionData, error: sessionError } = await authClient.getSession();
      if (sessionError) throw new Error(sessionError.message ?? "Could not restore your sign-in.");
      if (sessionData?.user) {
        onAuthenticated(email.trim());
        return;
      }
      setOtp("");
      setMode("verification");
      setNotice("Check your email for a verification code or link.");
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not create account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmailCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: verificationError } = await authClient.emailOtp.verifyEmail({
        email: email.trim(),
        otp: otp.trim(),
      });
      if (verificationError) throw new Error(verificationError.message ?? "Could not verify your email.");

      const { data, error: sessionError } = await authClient.getSession();
      if (sessionError) throw new Error(sessionError.message ?? "Could not restore your sign-in.");
      if (data?.user) {
        onAuthenticated(email.trim());
      } else {
        setMode("password");
        setNotice("Email verified. Sign in with your password to continue.");
      }
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not verify your email.");
    } finally {
      setBusy(false);
    }
  }

  async function continueAfterVerificationLink() {
    setError("");
    setBusy(true);
    try {
      const { data, error: sessionError } = await authClient.getSession();
      if (sessionError) throw new Error(sessionError.message ?? "Could not restore your sign-in.");
      if (data?.user) {
        onAuthenticated(email.trim());
      } else {
        setMode("password");
        setNotice("Email verified. Sign in with your password to continue.");
      }
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not restore your sign-in.");
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
      if (mode === "signup") void createAccount(event);
      else if (mode === "verification") void verifyEmailCode(event);
      else if (mode === "password") void signInWithPassword(event);
      else if (sent) void verifyCode(event);
      else void sendCode(event);
    }}>
      <h2>
        {mode === "signup" ? t("Create your account")
          : mode === "verification" ? t("Verify your email")
            : mode === "password" ? signInTitle
              : sent ? t("Enter your email code") : signInTitle}
      </h2>
      {mode === "verification" && <p>{t(notice)}</p>}
      {sent && <p>{t("A one-time code was sent to {email}.", { email: email.trim() })}</p>}
      {notice && mode !== "verification" && <div className="alert alert-info" role="status">{t(notice)}</div>}
      {mode === "signup" && (
        <label className="field">
          <span>{t("Your name")}</span>
          <input
            required
            type="text"
            autoComplete="name"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      )}
      {mode === "signup" || mode === "password" || (mode === "otp" && !sent) ? (
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
      ) : (mode === "verification" || (mode === "otp" && sent)) ? (
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
      ) : null}
      {(mode === "signup" || mode === "password") && (
        <label className="field">
          <span>{t("Password")}</span>
          <input
            required
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={mode === "signup" ? 8 : undefined}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      )}
      {error && <div className="field-error" role="alert">{t(error)}</div>}
      <div className="pin-row">
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? t("Please wait...")
            : mode === "signup" ? t("Create account")
              : mode === "verification" ? t("Verify email")
                : mode === "password" ? t("Sign in")
                  : sent ? t("Verify & sign in") : t("Send sign-in code")}
        </button>
        {mode === "otp" && sent && <button className="text-button" type="button" disabled={busy} onClick={() => { setSent(false); setOtp(""); setError(""); }}>{t("Change email")}</button>}
      </div>
      {mode === "verification" && (
        <button className="text-button" type="button" disabled={busy} onClick={() => void continueAfterVerificationLink()}>
          {t("I clicked the verification link")}
        </button>
      )}
      {allowPassword && (
        <div className="sign-in-options">
          {mode === "password" ? (
            <>
              <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("reset")}>{t("Set or reset password")}</button>
              <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("otp")}>{t("Use email code")}</button>
            </>
          ) : mode === "otp" ? (
            <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("password")}>{t("Use password")}</button>
          ) : mode === "signup" ? (
            <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("password")}>
              {t("Already have an account? Sign in")}
            </button>
          ) : mode === "verification" ? (
            <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("password")}>
              {t("Back to sign in")}
            </button>
          ) : null}
          {allowSignUp && (mode === "password" || mode === "otp") && (
            <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("signup")}>
              {t("New family? Create an account")}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
