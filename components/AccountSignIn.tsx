"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { PasswordResetForm } from "@/components/PasswordResetForm";
import { useLanguage } from "@/lib/i18n";

interface AuthenticatedAccount {
  name: string;
  email: string;
}

type Mode = "email-signup" | "email-verification" | "email-password" | "email-otp" | "reset";

export function AccountSignIn({
  onAuthenticated,
  title,
  allowPassword = false,
  allowSignUp = false,
  signUpPrompt,
}: {
  onAuthenticated: (account: AuthenticatedAccount) => void;
  title?: string;
  allowPassword?: boolean;
  allowSignUp?: boolean;
  signUpPrompt?: string;
}) {
  const { t } = useLanguage();
  const signInTitle = title ?? t("Family sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<Mode>(allowSignUp ? "email-signup" : "email-password");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setSent(false);
    setOtp("");
    setError("");
    setNotice("");
  }

  async function completeSignIn() {
    const { data, error: sessionError } = await authClient.getSession();
    if (sessionError) throw new Error(sessionError.message ?? "Could not restore your sign-in.");
    const user = data?.user;
    if (!user?.emailVerified) {
      throw new Error("Verify your email address before continuing.");
    }

    onAuthenticated({ name: user.name, email: user.email });
  }

  async function createEmailAccount(event: FormEvent<HTMLFormElement>) {
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

      if (data.user.emailVerified) {
        await completeSignIn();
        return;
      }

      setMode("email-verification");
      setNotice("Check your email for a verification code.");
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not create account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data, error: verificationError } = await authClient.emailOtp.verifyEmail({
        email: email.trim(),
        otp: otp.trim(),
      });
      if (verificationError) throw new Error(verificationError.message ?? "Could not verify your email.");
      if (!data?.user.emailVerified) throw new Error("Email verification was not completed.");

      const { data: sessionData, error: sessionError } = await authClient.getSession();
      if (sessionError) throw new Error(sessionError.message ?? "Could not restore your sign-in.");
      if (sessionData?.user?.emailVerified) {
        await completeSignIn();
      } else {
        changeMode("email-password");
        setNotice("Email verified. Sign in with your password.");
      }
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not verify your email.");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerificationCode() {
    setError("");
    setBusy(true);
    try {
      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "email-verification",
      });
      if (sendError) throw new Error(sendError.message ?? "Could not send the verification code.");
      setNotice("A new verification code was sent to your email.");
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not send the verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function sendEmailCode(event: FormEvent<HTMLFormElement>) {
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
      setError(cause instanceof Error && cause.message ? cause.message : "Could not send the sign-in code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifySignInCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: signInError } = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: otp.trim(),
      });
      if (signInError) throw new Error(signInError.message ?? "Could not verify the sign-in code.");
      await completeSignIn();
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not verify the sign-in code.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (signInError) throw new Error(signInError.message ?? "Could not sign in with that password.");
      await completeSignIn();
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not sign in with that password.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "reset") {
    return (
      <PasswordResetForm
        initialEmail={email.trim()}
        onCancel={() => changeMode("email-password")}
      />
    );
  }

  const isEmailVerification = mode === "email-verification";
  const isOtpSignIn = mode === "email-otp";

  return (
    <form
      className="pin-panel"
      onSubmit={(event) => {
        if (mode === "email-signup") void createEmailAccount(event);
        else if (isEmailVerification) void verifyEmailCode(event);
        else if (mode === "email-password") void signInWithPassword(event);
        else if (isOtpSignIn) void (sent ? verifySignInCode(event) : sendEmailCode(event));
      }}
    >
      <h2>
        {isEmailVerification ? t("Verify your email")
          : mode === "email-signup" ? t("Create your account")
            : isOtpSignIn && sent ? t("Enter your email code") : signInTitle}
      </h2>

      {notice && <div className="alert alert-info" role="status">{t(notice)}</div>}
      {mode === "email-signup" && (
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
      {!isEmailVerification && (
        <label className="field">
          <span>{t("Email address")}</span>
          <input
            required
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            readOnly={isOtpSignIn && sent}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
      )}
      {(isEmailVerification || (isOtpSignIn && sent)) && (
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
      {mode === "email-signup" && (
        <label className="field">
          <span>{t("Password")} <small>{t("8–128 characters")}</small></span>
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
      )}
      {mode === "email-password" && (
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
          {busy ? t("Please wait...")
            : mode === "email-signup" ? t("Create account")
              : isEmailVerification ? t("Verify & continue")
                : mode === "email-password" ? t("Sign in")
                  : isOtpSignIn ? sent ? t("Verify & sign in") : t("Send sign-in code")
                    : t("Continue")}
        </button>
      </div>
      <div className="sign-in-options">
        {allowPassword && mode === "email-password" && (
          <>
            <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("reset")}>
              {t("Set or reset password")}
            </button>
            <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-otp")}>
              {t("Use email code")}
            </button>
          </>
        )}
        {allowPassword && isOtpSignIn && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-password")}>
            {t("Use password")}
          </button>
        )}
        {allowSignUp && mode === "email-signup" && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-password")}>
            {t("Already have an account? Sign in")}
          </button>
        )}
        {allowSignUp && (mode === "email-password" || isOtpSignIn) && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-signup")}>
            {t(signUpPrompt ?? "New family? Create an account")}
          </button>
        )}
        {isEmailVerification && (
          <>
            <button className="text-button" type="button" disabled={busy} onClick={() => void resendVerificationCode()}>
              {t("Resend verification code")}
            </button>
            <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-password")}>
              {t("Back to sign in")}
            </button>
          </>
        )}
        {isOtpSignIn && sent && (
          <button className="text-button" type="button" disabled={busy} onClick={() => { setSent(false); setOtp(""); setError(""); }}>
            {t("Change email")}
          </button>
        )}
      </div>
    </form>
  );
}
