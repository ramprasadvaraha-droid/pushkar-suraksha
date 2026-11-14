"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { PasswordResetForm } from "@/components/PasswordResetForm";
import { useLanguage } from "@/lib/i18n";

interface AuthenticatedAccount {
  name: string;
  email: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  phoneNumberVerified: boolean;
}

type Mode =
  | "email-signup"
  | "email-verification"
  | "email-password"
  | "email-otp"
  | "phone-verification"
  | "reset";

export function AccountSignIn({
  onAuthenticated,
  title,
  allowPassword = false,
  allowSignUp = false,
  allowPhone = false,
  phonePassword = false,
  signUpCallbackURL,
  signUpPrompt,
}: {
  onAuthenticated: (account: AuthenticatedAccount) => void;
  title?: string;
  allowPassword?: boolean;
  allowSignUp?: boolean;
  allowPhone?: boolean;
  phonePassword?: boolean;
  signUpCallbackURL?: string;
  signUpPrompt?: string;
}) {
  const { t } = useLanguage();
  const signInTitle = title ?? t("Family sign-in");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<Mode>(allowSignUp ? "email-signup" : "email-password");
  const [phoneReturnMode, setPhoneReturnMode] = useState<Mode>("email-signup");
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

  const isPhoneIdentifier = allowPhone && /^\+?[\d\s().-]+$/.test(identifier.trim()) && /\d/.test(identifier);

  function normalizedPhone() {
    const digits = identifier.replace(/\D/g, "");
    const nationalNumber = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
    return `+91${nationalNumber}`;
  }

  async function completeSignIn(preferredName?: string) {
    const { data, error: sessionError } = await authClient.getSession();
    if (sessionError) throw new Error(sessionError.message ?? "Could not restore your sign-in.");
    const user = data?.user;
    if (!user || (!user.emailVerified && !user.phoneNumberVerified)) {
      throw new Error("Verify your email address or mobile number before continuing.");
    }

    onAuthenticated({
      name: preferredName || user.name,
      email: user.emailVerified ? user.email : null,
      phoneNumber: user.phoneNumberVerified ? user.phoneNumber ?? null : null,
      emailVerified: user.emailVerified,
      phoneNumberVerified: Boolean(user.phoneNumberVerified),
    });
  }

  async function createEmailAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const { data, error: signUpError } = await authClient.signUp.email({
        name: name.trim(),
        email: identifier.trim(),
        password,
        ...(signUpCallbackURL && {
          callbackURL: `${window.location.origin}${signUpCallbackURL}`,
        }),
      });
      if (signUpError) throw new Error(signUpError.message ?? "Could not create account. Please try again.");
      if (!data?.user) throw new Error("Could not create account. Please try again.");

      const { data: sessionData, error: sessionError } = await authClient.getSession();
      if (sessionError) throw new Error(sessionError.message ?? "Could not restore your sign-in.");
      if (sessionData?.user?.emailVerified) {
        await completeSignIn();
        return;
      }

      setMode("email-verification");
      setNotice("Check your email for a verification link, then return here.");
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not create account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function checkEmailVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await completeSignIn();
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not verify your email.");
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
        email: identifier.trim(),
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

  async function verifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: signInError } = await authClient.signIn.emailOtp({
        email: identifier.trim(),
        otp: otp.trim(),
        name: name.trim() || undefined,
      });
      if (signInError) throw new Error(signInError.message ?? "Could not verify the sign-in code.");
      await completeSignIn();
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not verify the sign-in code.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoneCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const digits = identifier.replace(/\D/g, "");
    const nationalNumber = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
    if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
      setError("Valid 10-digit Indian mobile number required.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "email-signup" || mode === "email-password" || mode === "email-otp") {
        setPhoneReturnMode(mode);
      }
      const { error: sendError } = await authClient.phoneNumber.sendOtp({
        phoneNumber: normalizedPhone(),
      });
      if (sendError) throw new Error(sendError.message ?? "Could not send the mobile verification code.");
      setMode("phone-verification");
      setOtp("");
      setNotice("A verification code was sent to your mobile number.");
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not send the mobile verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhoneCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: verificationError } = await authClient.phoneNumber.verify({
        phoneNumber: normalizedPhone(),
        code: otp.trim(),
      });
      if (verificationError) throw new Error(verificationError.message ?? "Could not verify the mobile number.");
      if (name.trim() && !phonePassword) {
        const { error: updateError } = await authClient.updateUser({ name: name.trim() });
        if (updateError) throw new Error(updateError.message ?? "Could not save your name.");
      }
      if (phonePassword && phoneReturnMode === "email-signup") {
        const response = await fetch("/api/volunteer/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: password }),
        });
        const body = await response.json() as { passwordAlreadySet?: boolean; error?: string };
        if (response.status === 409 && body.passwordAlreadySet) {
          const { error: signInError } = await authClient.signIn.phoneNumber({
            phoneNumber: normalizedPhone(),
            password,
          });
          if (signInError) {
            await authClient.signOut();
            setMode("email-password");
            throw new Error("This mobile number already has an account. Sign in with its existing password.");
          }
        } else if (!response.ok) {
          throw new Error(body.error ?? "Could not set your password.");
        }
      }
      await completeSignIn(phonePassword ? name.trim() : undefined);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not verify the mobile number.");
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
        email: identifier.trim(),
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

  async function signInWithPhonePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: signInError } = await authClient.signIn.phoneNumber({
        phoneNumber: normalizedPhone(),
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
        initialEmail={identifier.trim()}
        onCancel={() => changeMode("email-password")}
      />
    );
  }

  const isEmailVerification = mode === "email-verification";

  return (
    <form
      className="pin-panel"
      onSubmit={(event) => {
        if (allowPhone && isPhoneIdentifier && mode !== "phone-verification" && mode !== "email-verification") {
          if (phonePassword && mode === "email-password") void signInWithPhonePassword(event);
          else void sendPhoneCode(event);
        }
        else if (mode === "email-signup") void createEmailAccount(event);
        else if (mode === "email-verification") void checkEmailVerification(event);
        else if (mode === "email-password") void signInWithPassword(event);
        else if (mode === "email-otp") void (sent ? verifyEmailCode(event) : sendEmailCode(event));
        else if (mode === "phone-verification") void verifyPhoneCode(event);
      }}
    >
      <h2>
        {isPhoneIdentifier || mode === "phone-verification" ? t("Mobile sign-in or registration")
          : mode === "email-signup" ? t("Create your account")
          : mode === "email-verification" ? t("Verify your email")
            : mode === "email-password" ? signInTitle
              : sent ? t("Enter your email code") : signInTitle}
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
          <span>{t(allowPhone ? "Email or mobile number" : "Email address")}</span>
          <input
            required
            type={allowPhone && isPhoneIdentifier ? "tel" : "email"}
            inputMode={isPhoneIdentifier ? "tel" : "email"}
            autoComplete={isPhoneIdentifier ? "tel" : "email"}
            maxLength={254}
            readOnly={mode === "phone-verification"}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={allowPhone ? "you@example.com or 98765 43210" : "you@example.com"}
          />
        </label>
      )}
      {mode === "email-otp" && sent && !isPhoneIdentifier && (
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
      {mode === "email-signup" && (!isPhoneIdentifier || phonePassword) && (
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
      {mode === "email-password" && (!isPhoneIdentifier || phonePassword) && (
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
      {mode === "phone-verification" && (
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
      {error && <div className="field-error" role="alert">{t(error)}</div>}
      <div className="pin-row">
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? t("Please wait...")
            : mode === "email-signup" && isPhoneIdentifier ? t("Send mobile code")
              : mode === "email-signup" ? t("Create account")
              : mode === "email-verification" ? t("I verified my email")
                : mode === "email-password" ? t("Sign in")
                  : mode === "email-otp" ? isPhoneIdentifier ? t("Send mobile code") : sent ? t("Verify & sign in") : t("Send sign-in code")
                      : t("Verify & continue")}
        </button>
      </div>
      <div className="sign-in-options">
        {allowPassword && mode === "email-password" && !isPhoneIdentifier && (
          <>
            <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("reset")}>
              {t("Set or reset password")}
            </button>
            <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-otp")}>
              {t("Use email code")}
            </button>
          </>
        )}
        {allowPassword && phonePassword && isPhoneIdentifier && mode === "email-password" && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-otp")}>
            {t("Use mobile code")}
          </button>
        )}
        {allowPassword && mode === "email-otp" && !isPhoneIdentifier && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-password")}>
            {t("Use password")}
          </button>
        )}
        {allowPassword && phonePassword && isPhoneIdentifier && mode === "email-otp" && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-password")}>
            {t("Use password")}
          </button>
        )}
        {allowSignUp && mode === "email-signup" && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-password")}>
            {t("Already have an account? Sign in")}
          </button>
        )}
        {allowSignUp && (mode === "email-password" || mode === "email-otp") && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-signup")}>
            {t(signUpPrompt ?? "New family? Create an account")}
          </button>
        )}
        {isEmailVerification && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode("email-password")}>
            {t("Back to sign in")}
          </button>
        )}
        {mode === "phone-verification" && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode(phoneReturnMode)}>
            {t("Change email or mobile number")}
          </button>
        )}
        {mode === "email-otp" && sent && (
          <button className="text-button" type="button" disabled={busy} onClick={() => { setSent(false); setOtp(""); setError(""); }}>
            {t("Change email")}
          </button>
        )}
      </div>
    </form>
  );
}
