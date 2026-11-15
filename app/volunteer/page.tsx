"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AccountSignIn } from "@/components/AccountSignIn";
import { PasswordResetForm } from "@/components/PasswordResetForm";
import { getAppAuthUser, signOutApp } from "@/lib/auth/app-client";
import { LanguageSwitcher, useLanguage, type Translator } from "@/lib/i18n";

interface MissingItem {
  memberId: string;
  memberNumber: string;
  photoUrl: string | null;
  dressPhotoUrl: string | null;
  ghat: string;
  missingAt: string;
}

interface FaceSearchCandidate {
  memberId: string;
  memberNumber: string;
  photoUrl: string;
  ghat: string;
  missingAt: string;
  similarity: number;
}

interface VolunteerProfile {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface HandoverCounts {
  personal: number;
  total: number;
}

interface PendingVolunteer {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  createdAt: string;
}

interface FoundState {
  ghat: string;
  verificationSecret: string;
  coordinatorAttested: boolean;
  parentPhone: string;
  verified: boolean;
  verificationMethod: "secret" | "coordinator" | null;
  confirmed: boolean;
}

interface CompletedItem {
  memberNumber: string;
  photoUrl: string | null;
  ghat: string;
  phone: string;
}

const ghats = ["Pushkar Ghat", "Kotilingala Ghat", "Gowthami Ghat", "Markandeya Ghat", "Saraswathi Ghat"];

function errorText(error: unknown, t: Translator) {
  return error instanceof Error && error.message
    ? t(error.message)
    : t("Request could not be completed. Please try again.");
}

function emptyFoundState(ghat: string): FoundState {
  return {
    ghat,
    verificationSecret: "",
    coordinatorAttested: false,
    parentPhone: "",
    verified: false,
    verificationMethod: null,
    confirmed: false,
  };
}

export default function VolunteerPage() {
  const { t, language } = useLanguage();
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [organizerConfigured, setOrganizerConfigured] = useState(false);
  const [counts, setCounts] = useState<HandoverCounts | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingVolunteer[]>([]);
  const [items, setItems] = useState<MissingItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<Record<string, FoundState>>({});
  const [completed, setCompleted] = useState<CompletedItem[]>([]);
  const [pendingMember, setPendingMember] = useState<string | null>(null);
  const [brokenPhotos, setBrokenPhotos] = useState<string[]>([]);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [faceSearchBusy, setFaceSearchBusy] = useState(false);
  const [faceSearchError, setFaceSearchError] = useState("");
  const [faceSearchResults, setFaceSearchResults] = useState<FaceSearchCandidate[] | null>(null);

  const loadMissing = useCallback(async (cacheKey: string, initial = false) => {
    if (initial) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/volunteer/missing", {
        headers: { "x-volunteer-cache-key": cacheKey },
        cache: "no-store",
      });
      const body = await response.json() as { missing?: MissingItem[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Volunteer list could not be loaded.");
      setItems(body.missing ?? []);
      setOffline(response.headers.get("x-offline-cache") === "true");
    } catch (cause) {
      setError(errorText(cause, t));
      setOffline(!navigator.onLine);
    } finally {
      if (initial) setLoading(false);
    }
  }, [t]);

  const loadApprovals = useCallback(async () => {
    const response = await fetch("/api/volunteer/approvals", { cache: "no-store" });
    const body = await response.json() as { pending?: PendingVolunteer[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Pending registrations could not be loaded.");
    setPendingApprovals(body.pending ?? []);
  }, []);

  const refreshProfile = useCallback(async (initial = false) => {
    const response = await fetch("/api/volunteer/profile", { cache: "no-store" });
    const body = await response.json() as {
      profile?: VolunteerProfile | null;
      isOrganizer?: boolean;
      organizerConfigured?: boolean;
      counts?: HandoverCounts | null;
      error?: string;
    };
    if (!response.ok) throw new Error(body.error ?? "Volunteer profile could not be loaded.");

    const nextProfile = body.profile ?? null;
    const organizer = body.isOrganizer === true;
    setSignedIn(true);
    setProfile(nextProfile);
    setIsOrganizer(organizer);
    setOrganizerConfigured(body.organizerConfigured === true);
    setCounts(body.counts ?? null);

    if (nextProfile?.status === "approved") {
      await loadMissing(nextProfile.id, initial);
    } else {
      setItems([]);
      setLoading(false);
      setOffline(false);
    }

    if (organizer) {
      try {
        await loadApprovals();
      } catch (cause) {
        setError(errorText(cause, t));
      }
    } else {
      setPendingApprovals([]);
    }
  }, [loadApprovals, loadMissing, t]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const user = await getAppAuthUser();
        if (user) {
          if (active) {
            setAuthName(user.name);
            setAuthEmail(user.email ?? null);
            setSignedIn(true);
          }
          await refreshProfile(true);
        }
      } catch (cause) {
        if (active) setError(errorText(cause, t));
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => { active = false; };
  }, [refreshProfile, t]);

  useEffect(() => {
    if (profile?.status !== "approved") return;
    const timer = window.setInterval(() => { void loadMissing(profile.id); }, 15000);
    return () => window.clearInterval(timer);
  }, [loadMissing, profile?.id, profile?.status]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    if (!normalized) return items;
    return items.filter((item) => item.memberNumber.toUpperCase().includes(normalized));
  }, [items, query]);

  async function searchFace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("photo");
    setFaceSearchError("");
    setFaceSearchResults(null);
    if (!(file instanceof File) || !file.size) {
      setFaceSearchError(t("Choose a face photo to search."));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setFaceSearchError(t("Search photo must be 4 MB or smaller."));
      return;
    }

    setFaceSearchBusy(true);
    try {
      const response = await fetch("/api/volunteer/face-search", {
        method: "POST",
        body: new FormData(form),
        cache: "no-store",
      });
      const body = await response.json() as {
        candidates?: FaceSearchCandidate[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Face search could not be completed.");
      setFaceSearchResults(body.candidates ?? []);
      form.reset();
    } catch (cause) {
      setFaceSearchError(errorText(cause, t));
    } finally {
      setFaceSearchBusy(false);
    }
  }

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setRegistering(true);
    try {
      const response = await fetch("/api/volunteer/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: authName,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Volunteer registration could not be submitted.");
      await refreshProfile(true);
      setShowPasswordSetup(false);
    } catch (cause) {
      setError(errorText(cause, t));
    } finally {
      setRegistering(false);
    }
  }

  async function reviewVolunteer(volunteerId: string, decision: "approved" | "rejected") {
    setReviewingId(volunteerId);
    setError("");
    try {
      const response = await fetch("/api/volunteer/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volunteerId, decision }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Volunteer approval could not be updated.");
      await loadApprovals();
    } catch (cause) {
      setError(errorText(cause, t));
    } finally {
      setReviewingId(null);
    }
  }

  async function verifyGuardian(item: MissingItem, verificationMethod: "secret" | "coordinator" = "secret") {
    const current = found[item.memberId] ?? emptyFoundState(item.ghat);
    if (verificationMethod === "secret" && !current.verificationSecret.trim()) {
      setError(t("Enter the family verification secret."));
      return;
    }
    if (verificationMethod === "coordinator" && (!isOrganizer || !current.coordinatorAttested)) {
      setError(t("Confirm you personally verified the guardian in person."));
      return;
    }
    setPendingMember(item.memberId);
    setError("");
    try {
      const response = await fetch("/api/volunteer/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: item.memberId,
          ghat: current.ghat,
          verificationSecret: current.verificationSecret,
          verificationMethod,
          coordinatorAttested: current.coordinatorAttested,
        }),
      });
      const body = await response.json() as {
        parentPhone?: string;
        verificationMethod?: "secret" | "coordinator";
        error?: string;
      };
      if (!response.ok || !body.parentPhone) throw new Error(body.error ?? "Guardian verification could not be completed.");
      setFound((previous) => ({
        ...previous,
        [item.memberId]: {
          ...current,
          verificationSecret: "",
          coordinatorAttested: false,
          parentPhone: body.parentPhone!,
          verified: true,
          verificationMethod: body.verificationMethod ?? verificationMethod,
          confirmed: false,
        },
      }));
    } catch (cause) {
      setError(errorText(cause, t));
    } finally {
      setPendingMember(null);
    }
  }

  async function confirmHandover(item: MissingItem) {
    const current = found[item.memberId];
    if (!current?.verified || !current.confirmed) return;
    setPendingMember(item.memberId);
    setError("");
    try {
      const response = await fetch("/api/volunteer/found", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: item.memberId }),
      });
      const body = await response.json() as { counts?: HandoverCounts; error?: string };
      if (!response.ok || !body.counts) throw new Error(body.error ?? "Handover could not be recorded.");
      setCounts(body.counts);
      setCompleted((previous) => [{
        memberNumber: item.memberNumber,
        photoUrl: item.photoUrl,
        ghat: current.ghat,
        phone: current.parentPhone,
      }, ...previous]);
      setItems((previous) => previous.filter((record) => record.memberId !== item.memberId));
      setFound((previous) => {
        const next = { ...previous };
        delete next[item.memberId];
        return next;
      });
    } catch (cause) {
      setError(errorText(cause, t));
    } finally {
      setPendingMember(null);
    }
  }

  async function logout() {
    setError("");
    try {
      const { error: signOutError } = await signOutApp();
      if (signOutError) throw new Error(signOutError.message ?? "Sign out could not be completed.");
    } catch (cause) {
      setError(errorText(cause, t));
    } finally {
      setSignedIn(false);
      setProfile(null);
      setAuthName("");
      setAuthEmail(null);
      setIsOrganizer(false);
      setCounts(null);
      setPendingApprovals([]);
      setItems([]);
      setFound({});
      setCompleted([]);
      setShowPasswordSetup(false);
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.ready.then((registration) => {
          registration.active?.postMessage({ type: "CLEAR_VOLUNTEER_CACHE" });
        });
      }
    }
  }

  const approved = profile?.status === "approved";

  return (
    <div className="app-shell volunteer-shell">
      <div className="top-gold-rule" />
      <header className="app-header">
        <div className="trust-mark">PS</div>
        <div className="brand-lockup"><strong>{t("Volunteer Desk")}</strong><span>{t("Pushkar Suraksha · Seva")}</span></div>
        {signedIn && <button className="text-button" type="button" onClick={() => void logout()}>{t("Logout")}</button>}
      </header>
      <div className="festival-strip"><span>{t("SEVA KENDRAM")}</span></div>
      <div className="language-bar"><LanguageSwitcher /></div>
      <main className="main-content volunteer-main">
        <div className="volunteer-heading">
          <div className="board-seal">PS</div>
          <div><h1>{t("Missing members")}</h1></div>
        </div>

        {!authReady && <div className="empty-note">{t("Checking volunteer session...")}</div>}
        {authReady && !signedIn && (
          <AccountSignIn
            title={t("Volunteer sign-in")}
            allowPassword
            allowSignUp
            signUpPrompt="New volunteer? Create an account"
            onAuthenticated={(account) => {
              setAuthName(account.name);
              setAuthEmail(account.email ?? null);
              setLoading(true);
              setError("");
              void refreshProfile(true)
                .catch((cause) => setError(errorText(cause, t)))
                .finally(() => setLoading(false));
            }}
          />
        )}

        {signedIn && !profile && (
          <>
            <form className="pin-panel" onSubmit={(event) => void register(event)}>
              <h2>{t("Volunteer registration")}</h2>
              <p>{t("Submit your verified account for organizer approval before you can access missing-person reports.")}</p>
              <p><strong>{t("Full Name")}:</strong> {authName}</p>
              {!organizerConfigured && <div className="alert alert-error" role="alert">{t("Volunteer organizer emails are not configured. Contact the festival coordinator.")}</div>}
              <button className="button button-primary" type="submit" disabled={registering || !organizerConfigured}>
                {registering ? t("Submitting...") : t("Submit for organizer approval")}
              </button>
            </form>
            {isOrganizer && <OrganizerApprovals pending={pendingApprovals} reviewingId={reviewingId} onReview={reviewVolunteer} />}
          </>
        )}

        {signedIn && profile?.status === "pending" && (
          <div className="alert alert-info" role="status">
            {t("Registration received for {name}. The organizer must approve your account before you can view missing reports.", { name: profile.fullName })}
          </div>
        )}
        {signedIn && profile?.status === "rejected" && (
          <div className="alert alert-error" role="status">
            {t("Your volunteer registration was not approved. You can submit an updated request below.")}
            <button type="button" className="text-button" onClick={() => setProfile(null)}>{t("Update registration")}</button>
          </div>
        )}

        {signedIn && profile && authEmail && (
          <div className="volunteer-password-setup">
            {showPasswordSetup ? (
              <PasswordResetForm
                initialEmail={profile.email ?? authEmail}
                allowEmailChange={false}
                onCancel={() => setShowPasswordSetup(false)}
              />
            ) : (
              <button className="text-button" type="button" onClick={() => setShowPasswordSetup(true)}>
                {t("Set or reset password for future sign-ins")}
              </button>
            )}
          </div>
        )}

        {isOrganizer && profile && (
          <OrganizerApprovals pending={pendingApprovals} reviewingId={reviewingId} onReview={reviewVolunteer} />
        )}

        {approved && (
          <>
            <div className="handover-counts" aria-label={t("Verified family handovers")}>
              <div><strong>{counts?.personal ?? 0}</strong><span>{t("Your verified handovers")}</span></div>
              <div><strong>{counts?.total ?? 0}</strong><span>{t("Event total")}</span></div>
            </div>
            <section className="face-search-panel" aria-labelledby="face-search-heading">
              <h2 id="face-search-heading">{t("Search by face")}</h2>
              <p>{t("Upload one clear face photo. The search photo is processed temporarily and is not saved.")}</p>
              <p className="face-search-warning">{t("Results are similarity suggestions, not identity proof. Always compare manually and verify the guardian before a handover.")}</p>
              <form className="face-search-form" onSubmit={(event) => void searchFace(event)}>
                <input
                  type="file"
                  name="photo"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  required
                  disabled={faceSearchBusy}
                />
                <button className="button button-primary" type="submit" disabled={faceSearchBusy}>
                  {faceSearchBusy ? t("Searching faces...") : t("Search missing members")}
                </button>
              </form>
              {faceSearchError && <p className="field-error" role="alert">{faceSearchError}</p>}
              {faceSearchResults && (
                <div className="face-search-results" role="status">
                  {!faceSearchResults.length && <p>{t("No likely candidates. Continue checking the missing-person list manually.")}</p>}
                  {faceSearchResults.map((candidate) => (
                    <article className="face-search-result" key={candidate.memberId}>
                      <Image src={candidate.photoUrl} alt={`${t("Member number")} ${candidate.memberNumber}`} width={48} height={54} unoptimized />
                      <div>
                        <strong className="number-mono">{candidate.memberNumber}</strong>
                        <span>{t("Last seen: {ghat}", { ghat: candidate.ghat })}</span>
                        <span>{t("Similarity score: {score}", { score: candidate.similarity.toFixed(3) })}</span>
                      </div>
                      <button className="text-button" type="button" onClick={() => setQuery(candidate.memberNumber)}>
                        {t("Open report")}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <div className="volunteer-toolbar">
              <input className="search-input" aria-label={t("Search by member number")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="PK-08423" />
              <span className="volunteer-count">{t("{count} active", { count: filtered.length })}</span>
            </div>
            {offline && <div className="offline-indicator" role="status">{t("Offline copy · Last synced list")}</div>}
            {loading && <div className="empty-note">{t("Missing list loading...")}</div>}
            {error && <div className="alert alert-error" role="alert">{t(error)}<button type="button" className="text-button" onClick={() => void loadMissing(profile.id, true)}>{t("Retry")}</button></div>}
            {!!completed.length && (
              <section className="recent-found">
                <h2>{t("Handed over · Family reunited")}</h2>
                {completed.map((record, index) => (
                  <motion.article key={`${record.memberNumber}-${index}`} className="recent-found-card" initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }}>
                    {record.photoUrl && <Image src={record.photoUrl} alt={`${t("Member number")} ${record.memberNumber}`} width={42} height={48} unoptimized />}
                    <div><strong className="number-mono">{record.memberNumber}</strong><span>{record.ghat}</span><a href={`tel:${record.phone}`}>{t("Parent: +91 {phone}", { phone: record.phone })}</a></div>
                    <span className="found-tick">✓</span>
                  </motion.article>
                ))}
              </section>
            )}
            {!loading && !filtered.length && <div className="empty-note">{query ? t("Report not found for this number.") : t("No missing reports. Your family is safe.")}</div>}
            <div className="screen-stack">
              <AnimatePresence>
                {filtered.map((item, index) => {
                  const state = found[item.memberId] ?? emptyFoundState(item.ghat);
                  return (
                    <motion.article key={item.memberId} className="volunteer-record" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, rotateY: 85 }} transition={{ delay: index * 0.045 }}>
                      {item.photoUrl && !brokenPhotos.includes(item.memberId)
                        ? <Image className="volunteer-photo" src={item.photoUrl} alt={`${t("Member number")} ${item.memberNumber}`} width={60} height={67} unoptimized onError={() => setBrokenPhotos((previous) => [...previous, item.memberId])} />
                        : <div className="volunteer-photo found-photo-placeholder" aria-hidden="true">PS</div>}
                      <div className="volunteer-content">
                        <strong className="number-mono">{item.memberNumber}</strong>
                        <div className="volunteer-meta">
                          <span>{t("Last seen: {ghat}", { ghat: item.ghat })}</span>
                          <span>{new Date(item.missingAt).toLocaleTimeString(language === "te" ? "te-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        {item.dressPhotoUrl && <div className="dress-mini"><Image src={item.dressPhotoUrl} alt={t("Today's dress photo")} width={26} height={26} unoptimized /> {t("Today's dress photo")}</div>}
                        {!state.verified && (
                          <>
                            <select
                              aria-label={t("Found ghat for {number}", { number: item.memberNumber })}
                              className="ghat-select"
                              value={state.ghat}
                              onChange={(event) => setFound((previous) => ({
                                ...previous,
                                [item.memberId]: { ...emptyFoundState(event.target.value), verificationSecret: previous[item.memberId]?.verificationSecret ?? "" },
                              }))}
                            >
                              {ghats.map((ghat) => <option key={ghat}>{ghat}</option>)}
                            </select>
                            <label className="found-secret-field">
                              <span>
                                {t("Guardian verification secret")}{" "}
                                <small>{t(isOrganizer ? "Required for this option" : "Required")}</small>
                              </span>
                              <input
                                type="password"
                                autoComplete="off"
                                required
                                maxLength={120}
                                value={state.verificationSecret}
                                onChange={(event) => setFound((previous) => ({
                                  ...previous,
                                  [item.memberId]: { ...state, verificationSecret: event.target.value },
                                }))}
                                placeholder={t("Ask the parent for the verification secret")}
                              />
                            </label>
                            <motion.button
                              className="button button-found" type="button" whileTap={{ scale: .97 }}
                              disabled={pendingMember === item.memberId || offline || !state.verificationSecret.trim()}
                              onClick={() => void verifyGuardian(item)}
                            >
                              {pendingMember === item.memberId ? t("Verifying...") : t("Verify guardian & show contact")}
                            </motion.button>
                            {isOrganizer && (
                              <div className="coordinator-fallback">
                                <p>{t("Use this fallback only if the guardian has forgotten the secret. The coordinator must verify the guardian in person and complete the handover.")}</p>
                                <label className="handover-check">
                                  <input
                                    type="checkbox"
                                    checked={state.coordinatorAttested}
                                    disabled={pendingMember === item.memberId || offline}
                                    onChange={(event) => setFound((previous) => ({
                                      ...previous,
                                      [item.memberId]: { ...state, coordinatorAttested: event.target.checked },
                                    }))}
                                  />
                                  <span>{t("I personally verified this guardian in person and will complete the handover.")}</span>
                                </label>
                                <motion.button
                                  className="button button-found" type="button" whileTap={{ scale: .97 }}
                                  disabled={pendingMember === item.memberId || offline || !state.coordinatorAttested}
                                  onClick={() => void verifyGuardian(item, "coordinator")}
                                >
                                  {pendingMember === item.memberId ? t("Verifying...") : t("Coordinator verification & show contact")}
                                </motion.button>
                              </div>
                            )}
                          </>
                        )}
                        {state.verified && (
                          <div className="handover-confirm">
                            <h3>{t(state.verificationMethod === "coordinator" ? "Coordinator verified guardian in person" : "Guardian verified")}</h3>
                            <p>{t(state.verificationMethod === "coordinator"
                              ? "Stay with the verified guardian and physically hand over the child before confirming below."
                              : "Call the parent, then physically hand over the child before confirming below.")}</p>
                            <a href={`tel:${state.parentPhone}`}>{t("Parent: +91 {phone}", { phone: state.parentPhone })}</a>
                            <label className="handover-check">
                              <input
                                type="checkbox"
                                checked={state.confirmed}
                                onChange={(event) => setFound((previous) => ({
                                  ...previous,
                                  [item.memberId]: { ...state, confirmed: event.target.checked },
                                }))}
                              />
                              <span>{t("I confirm the child has been handed to the verified parent/guardian.")}</span>
                            </label>
                            <button
                              className="button button-found" type="button"
                              disabled={pendingMember === item.memberId || offline || !state.confirmed}
                              onClick={() => void confirmHandover(item)}
                            >
                              {pendingMember === item.memberId ? t("Recording handover...") : t("Confirm physical handover")}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
            <p className="fine-print">{t("A handover is counted only after guardian verification and your physical-handover confirmation.")}</p>
          </>
        )}
        {error && !approved && <div className="alert alert-error" role="alert">{t(error)}</div>}
        <Link className="volunteer-back" href="/">← {t("Family app")}</Link>
      </main>
      <footer className="volunteer-footer">{t("Volunteer seva desk · Personal details are shown only when reuniting a family.")}</footer>
    </div>
  );
}

function OrganizerApprovals({
  pending,
  reviewingId,
  onReview,
}: {
  pending: PendingVolunteer[];
  reviewingId: string | null;
  onReview: (volunteerId: string, decision: "approved" | "rejected") => void;
}) {
  const { t, language } = useLanguage();
  return (
    <section className="approval-panel">
      <div className="section-caption"><h2>{t("Volunteer approvals")}</h2><span>{t("{count} pending", { count: pending.length })}</span></div>
      {!pending.length && <p className="empty-note">{t("No volunteer registrations need review.")}</p>}
      {pending.map((volunteer) => (
        <article className="approval-card" key={volunteer.id}>
          <strong>{volunteer.fullName}</strong>
          {volunteer.email && <span>{volunteer.email}</span>}
          {volunteer.phone && <a href={`tel:${volunteer.phone}`}>+91 {volunteer.phone}</a>}
          <small>{t("Requested {date}", { date: new Date(volunteer.createdAt).toLocaleString(language === "te" ? "te-IN" : "en-IN") })}</small>
          <div className="approval-actions">
            <button className="button button-primary" type="button" disabled={reviewingId === volunteer.id} onClick={() => onReview(volunteer.id, "approved")}>{t("Approve")}</button>
            <button className="button button-outline" type="button" disabled={reviewingId === volunteer.id} onClick={() => onReview(volunteer.id, "rejected")}>{t("Reject")}</button>
          </div>
        </article>
      ))}
    </section>
  );
}
