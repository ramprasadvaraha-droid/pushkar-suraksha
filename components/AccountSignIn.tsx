"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { getAppAuthUser, phoneAuthEnabled } from "@/lib/auth/app-client";
import { PasswordResetForm } from "@/components/PasswordResetForm";
import { useLanguage } from "@/lib/i18n";

interface AuthenticatedAccount {
  name: string;
  email?: string;
}

type Mode = "signup" | "signin" | "email-verification" | "reset";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

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
  const [identity, setIdentity] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>(allowSignUp ? "signup" : "signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setOtp("");
    setError("");
    setNotice("");
  }

  async function completeSignIn() {
    if (phoneAuthEnabled) {
      const response = await fetch("/api/phone-auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not switch signed-in accounts.");
    }

    const user = await getAppAuthUser();
    if (!user?.emailVerified) throw new Error("Could not restore your verified sign-in.");
    onAuthenticated({ name: user.name, email: user.email });
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const email = identity.trim();
      if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
      const { data, error: signUpError } = await authClient.signUp.email({
        name: name.trim(),
        email,
        password,
      });
      if (signUpError) throw new Error(signUpError.message ?? "Could not create account. Please try again.");
      if (!data?.user) throw new Error("Could not create account. Please try again.");
      if (data.user.emailVerified) {
        await completeSignIn();
      } else {
        setIdentity(email);
        setMode("email-verification");
        setNotice("Check your email for a verification code.");
      }
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
        email: identity.trim(),
        otp: otp.trim(),
      });
      if (verificationError) throw new Error(verificationError.message ?? "Could not verify your email.");
      if (!data?.user.emailVerified) throw new Error("Email verification was not completed.");

      const { data: sessionData, error: sessionError } = await authClient.getSession();
      if (sessionError) throw new Error(sessionError.message ?? "Could not restore your sign-in.");
      if (sessionData?.user?.emailVerified) {
        await completeSignIn();
      } else {
        changeMode("signin");
        setNotice("Email verified. Sign in with your password.");
      }
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not verify your email.");
    } finally {
      setBusy(false);
    }
  }

  async function resendEmailVerificationCode() {
    setError("");
    setBusy(true);
    try {
      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
        email: identity.trim(),
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

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const email = identity.trim();
      if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
      });
      if (signInError) throw new Error(signInError.message ?? "Could not sign in with that email and password.");
      await completeSignIn();
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "reset") {
    return (
      <PasswordResetForm
        initialEmail={isValidEmail(identity) ? identity.trim() : ""}
        onCancel={() => changeMode("signin")}
      />
    );
  }

  const isSignup = mode === "signup";
  const isEmailVerification = mode === "email-verification";

  return (
    <form
      className="pin-panel"
      onSubmit={(event) => {
        if (isSignup) void createAccount(event);
        else if (isEmailVerification) void verifyEmailCode(event);
        else if (mode === "signin") void signIn(event);
      }}
    >
      <h2>{isEmailVerification ? t("Verify your email") : isSignup ? t("Create your account") : signInTitle}</h2>

      {notice && <div className="alert alert-info" role="status">{t(notice)}</div>}
      {isSignup && (
        <label className="field">
          <span>{t("Full Name")}</span>
          <input
            required
            type="text"
            autoComplete="name"
            minLength={2}
            maxLength={100}
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
            autoComplete="username"
            maxLength={254}
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
      )}
      {(isSignup || mode === "signin") && (
        <label className="field">
          <span>{t("Password")}{isSignup && <small> {t("8–128 characters")}</small>}</span>
          <input
            required
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : undefined}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      )}
      {isEmailVerification && (
        <label className="field">
          <span>{t("One-time code")}</span>
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
          />
        </label>
      )}
      {error && <div className="field-error" role="alert">{t(error)}</div>}
      <div className="pin-row">
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? t("Please wait...")
            : isSignup ? t("Create account")
              : isEmailVerification ? t("Verify & continue")
                : mode === "signin" ? t("Sign in") : t("Continue")}
        </button>
      </div>
      <div className="sign-in-options">
        {allowPassword && mode === "signin" && (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => {
              if (!isValidEmail(identity)) {
                setError("Enter a valid email address.");
                return;
              }
              changeMode("reset");
            }}
          >
            {t("Forgot password?")}
          </button>
        )}
        {allowSignUp && isSignup && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("signin")}>
            {t("Already have an account? Sign in")}
          </button>
        )}
        {allowSignUp && mode === "signin" && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("signup")}>
            {t(signUpPrompt ?? "Create account")}
          </button>
        )}
        {isEmailVerification && (
          <>
            <button className="text-button" type="button" disabled={busy} onClick={() => void resendEmailVerificationCode()}>
              {t("Resend verification code")}
            </button>
            <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("signin")}>
              {t("Back to sign in")}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
