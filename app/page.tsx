"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AccountSignIn } from "@/components/AccountSignIn";
import { DeleteFamilyPhotos } from "@/components/DeleteFamilyPhotos";
import { MemberCard } from "@/components/MemberCard";
import { NumberBadge } from "@/components/NumberBadge";
import { PasswordResetForm } from "@/components/PasswordResetForm";
import { PhotoUploader, type PhotoChoice } from "@/components/PhotoUploader";
import { authClient } from "@/lib/auth/client";
import { LanguageSwitcher, useLanguage, type Translator } from "@/lib/i18n";
import { uploadPhoto } from "@/lib/upload-photo";
import type { FamilyRecord, Gender, MemberInput, MemberRecord, Relation } from "@/lib/types";

type Tab = "family" | "dress" | "missing" | "found";
type RegistrationMember = MemberInput & { photos: Record<string, File | undefined> };

const relations: Relation[] = ["Father", "Mother", "Son", "Daughter", "Other"];
const genders: Gender[] = ["Male", "Female", "Other"];
const ghats = ["Pushkar Ghat", "Kotilingala Ghat", "Gowthami Ghat", "Markandeya Ghat", "Saraswathi Ghat"];
const adultPhoto: PhotoChoice[] = [{ type: "face_front", title: "Face front", hint: "Clear face, look straight at the camera" }];
const childPhotos: PhotoChoice[] = [
  { type: "face_front", title: "Face front close", hint: "Face should be clear" },
  { type: "full_body", title: "Full body", hint: "From head to feet" },
  { type: "side", title: "Side photo", hint: "From one side" },
  { type: "with_family", title: "With family", hint: "Together with family" },
];

interface FoundRecord {
  memberNumber: string;
  photoUrl: string | null;
  ghat: string;
  foundAt: string;
}

function messageFrom(error: unknown, t: Translator): string {
  return error instanceof Error ? t(error.message) : t("Something went wrong. Please try again.");
}

function NavIcon({ type }: { type: Tab }) {
  const paths: Record<Tab, string> = {
    family: "M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6",
    dress: "M8 3 5 5l-3 5 4 2 2-3v12h8V9l2 3 4-2-3-5-3-2a6 6 0 0 1-8 0Z",
    missing: "M12 9v4m0 4h.01M10.3 3.8 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.8a2 2 0 0 0-3.4 0Z",
    found: "M20 11.1V12a8 8 0 1 1-4.7-7.3M20 4l-8 8-3-3",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[type]} /></svg>;
}

function RegistrationForm({ onRegistered, busy, onBusyChange, initialPhone }: {
  onRegistered: (family: FamilyRecord, secretHint: string) => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  initialPhone: string;
}) {
  const { t } = useLanguage();
  const [familyName, setFamilyName] = useState("Ramulu Family");
  const [phone, setPhone] = useState(initialPhone);
  const [alternativePhone, setAlternativePhone] = useState("");
  const [district, setDistrict] = useState("East Godavari");
  const [secret, setSecret] = useState("");
  const [members, setMembers] = useState<RegistrationMember[]>([
    { name: "Ramulu", age: 45, relation: "Father", gender: "Male", photos: {} },
  ]);
  const [error, setError] = useState("");

  function updateMember(index: number, patch: Partial<RegistrationMember>) {
    setMembers((previous) => previous.map((member, position) =>
      position === index ? { ...member, ...patch } : member,
    ));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError(t("Valid 10-digit Indian mobile number required."));
      return;
    }
    if (alternativePhone && (!/^[6-9]\d{9}$/.test(alternativePhone) || alternativePhone === phone)) {
      setError(t("Enter a different valid alternative mobile number, or leave it blank."));
      return;
    }
    if (secret.trim().length < 3) {
      setError(t("Secret must be at least 3 characters."));
      return;
    }
    for (let index = 0; index < members.length; index += 1) {
      const required = members[index].age < 18 ? childPhotos : adultPhoto;
      const missing = required.find((choice) => !members[index].photos[choice.type]);
      if (missing) {
        setError(t("Upload a {photo} photo for {member}.", {
          photo: t(missing.title),
          member: members[index].name || t("Member {number}", { number: index + 1 }),
        }));
        return;
      }
    }

    onBusyChange(true);
    let createdFamily: FamilyRecord | undefined;
    const uploadedPaths: string[] = [];
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyName, phone, alternativePhone: alternativePhone || null, district, secret,
          members: members.map(({ name, age, relation, gender }) => ({ name, age, relation, gender })),
        }),
      });
      const body = await response.json() as { family?: FamilyRecord; error?: string };
      if (!response.ok || !body.family) throw new Error(body.error ?? "Registration could not be completed.");
      createdFamily = body.family;

      const photos: { memberId: string; photoType: string; storagePath: string }[] = [];
      for (let index = 0; index < members.length; index += 1) {
        const registeredMember = createdFamily.members[index];
        for (const [photoType, file] of Object.entries(members[index].photos)) {
          if (!file) continue;
          const storagePath = await uploadPhoto(file, registeredMember.id, photoType);
          uploadedPaths.push(storagePath);
          photos.push({ memberId: registeredMember.id, photoType, storagePath });
        }
      }

      const photosResponse = await fetch("/api/register/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId: createdFamily.id, photos }),
      });
      const photoBody = await photosResponse.json() as { family?: FamilyRecord; secretHint?: string; error?: string };
      if (!photosResponse.ok || !photoBody.family) {
        throw new Error(photoBody.error ?? "Private family photos could not be finalized.");
      }
      onRegistered(photoBody.family, photoBody.secretHint ?? `${secret.slice(0, 1)}•••`);
    } catch (cause) {
      setError(messageFrom(cause, t));
      if (createdFamily) {
        try {
          const cleanup = await fetch("/api/register/cleanup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ familyId: createdFamily.id, storagePaths: uploadedPaths }),
          });
          if (!cleanup.ok) {
            const cleanupBody = await cleanup.json() as { error?: string };
            console.error("Could not clean up incomplete registration.", cleanupBody.error);
            setError(`${messageFrom(cause, t)} ${t(cleanupBody.error ?? "Incomplete data may remain; contact the festival help desk.")}`);
          }
        } catch (cleanupError) {
          console.error("Could not reach registration cleanup endpoint.", cleanupError);
          setError(`${messageFrom(cause, t)} ${t("Incomplete data cleanup failed; contact the festival help desk.")}`);
        }
      }
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <form className="registration-form" onSubmit={(event) => void submit(event)}>
      <section className="form-section">
        <div className="section-heading">
          <span className="step-number">01</span>
          <div><h2>{t("Family details")}</h2><p>{t("Family information")}</p></div>
        </div>
        <label className="field">
          <span>{t("Family name")}</span>
          <input required maxLength={100} value={familyName} onChange={(event) => setFamilyName(event.target.value)} />
        </label>
        <label className="field">
          <span>{t("Phone number")} <small>{t("10-digit India mobile")}</small></span>
          <div className="phone-input"><span>+91</span><input
            required inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="98765 43210"
          /></div>
        </label>
        <label className="field">
          <span>{t("Alternative mobile number")} <small>{t("Optional")}</small></span>
          <div className="phone-input"><span>+91</span><input
            inputMode="numeric" autoComplete="tel-national" maxLength={10} value={alternativePhone}
            onChange={(event) => setAlternativePhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="98765 43210"
          /></div>
        </label>
        <label className="field">
          <span>{t("Home district")} <small>{t("District")}</small></span>
          <input required maxLength={80} value={district} onChange={(event) => setDistrict(event.target.value)} />
        </label>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <span className="step-number">02</span>
          <div><h2>{t("Family members")}</h2><p>{t("Give each person a unique number.")}</p></div>
        </div>
        <div className="member-edit-list">
          {members.map((member, index) => (
            <motion.article key={index} className="member-edit-card" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="member-edit-heading">
                <strong>{t("Member {number}", { number: String(index + 1).padStart(2, "0") })}</strong>
                {members.length > 1 && <button className="text-button remove-button" type="button" onClick={() => setMembers((previous) => previous.filter((_, position) => position !== index))}>{t("Remove")}</button>}
              </div>
              <label className="field">
                <span>{t("Name")}</span>
                <input required maxLength={100} value={member.name} onChange={(event) => updateMember(index, { name: event.target.value })} />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>{t("Age")}</span>
                  <input required type="number" min={0} max={120} value={member.age} onChange={(event) => updateMember(index, { age: Number(event.target.value) })} />
                </label>
                <label className="field">
                  <span>{t("Relation")}</span>
                  <select value={member.relation} onChange={(event) => updateMember(index, { relation: event.target.value as Relation })}>
                    {relations.map((relation) => <option key={relation} value={relation}>{t(relation)}</option>)}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>{t("Gender")}</span>
                <select value={member.gender} onChange={(event) => updateMember(index, { gender: event.target.value as Gender })}>
                  {genders.map((gender) => <option key={gender} value={gender}>{t(gender)}</option>)}
                </select>
              </label>
              <div className="photo-rule">
                <strong>{t(member.age < 18 ? "Child photos · 4 required" : "Adult photo · 1 required")}</strong>
                <span>{t(member.age < 18 ? "Face + full body + side + family photo" : "Face close-up, clear photo")}</span>
              </div>
              <PhotoUploader
                choices={member.age < 18 ? childPhotos : adultPhoto}
                value={member.photos}
                onChange={(type, file) => updateMember(index, { photos: { ...member.photos, [type]: file } })}
                disabled={busy}
              />
            </motion.article>
          ))}
        </div>
        <button
          type="button" className="button button-outline add-member-button"
          disabled={members.length >= 9 || busy}
          onClick={() => setMembers((previous) => [...previous, { name: "", age: 18, relation: "Other", gender: "Other", photos: {} }])}
        >
          <span aria-hidden="true">+</span> {t("Add family member")} <small>{members.length}/9</small>
        </button>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <span className="step-number">03</span>
          <div><h2>{t("Secret verification")}</h2><p>{t("Verify the parent before handing over a child.")}</p></div>
        </div>
        <label className="field">
          <span>{t("Secret verification")} <small>{t("Only your family knows")}</small></span>
          <input
            required minLength={3} maxLength={120} value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={t("e.g. A birthmark on the left hand")}
          />
        </label>
        <p className="privacy-note">{t("This secret is not printed on the slip. Only a hint is shown.")}</p>
      </section>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="form-footnote">{t("After registration, you will receive a family number and a printable safety slip for each member.")}</div>
      <button className="button button-primary register-button" type="submit" disabled={busy}>
        {busy ? <><span className="button-spinner" /> {t("Secure registration in progress...")}</> : t("Register family")}
      </button>
    </form>
  );
}

function DressScreen({ family, onPhotoSaved }: {
  family: FamilyRecord;
  onPhotoSaved: (memberId: string, url: string) => void;
}) {
  const { t } = useLanguage();
  const children = family.members.filter((member) => member.age < 18);
  const [busyMember, setBusyMember] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  if (!children.length) return <div className="empty-note">{t("No children have been added to your family. Add members in Family details.")}</div>;

  async function upload(member: MemberRecord, file?: File) {
    if (!file) return;
    setBusyMember(member.id);
    setMessage("");
    let storagePath: string | undefined;
    try {
      storagePath = await uploadPhoto(file, member.id, "dress_today");
      const response = await fetch("/api/photos/dress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, storagePath }),
      });
      const body = await response.json() as { photoUrl?: string; error?: string };
      if (!response.ok || !body.photoUrl) throw new Error(body.error ?? "Dress photo upload failed.");
      onPhotoSaved(member.id, body.photoUrl);
      setMessage(t("Dress photo uploaded safely for {name}.", { name: member.name }));
    } catch (error) {
      if (storagePath) {
        try {
          const cleanup = await fetch("/api/photos/dress", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId: member.id, storagePath }),
          });
          if (!cleanup.ok) {
            const cleanupBody = await cleanup.json() as { error?: string };
            console.error("Dress photo cleanup request failed.", cleanupBody.error);
          }
        } catch (cleanupError) {
          console.error("Could not reach dress photo cleanup endpoint.", cleanupError);
        }
      }
      setMessage(messageFrom(error, t));
    } finally {
      setBusyMember(null);
    }
  }

  return (
    <div className="screen-stack">
      <div className="reminder-strip">
        <span className="reminder-mark">{t("TODAY")}</span>
        <strong>{t("Upload today's outfit photo to help volunteers identify children.")}</strong>
        <p>{t("Take a photo of what each child is wearing today.")}</p>
      </div>
      {children.map((member, index) => (
        <motion.article key={member.id} className="dress-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
          <div className="dress-card-heading">
            <div><strong>{member.name}</strong><span>{t("Age {age}", { age: member.age })}</span></div>
            <NumberBadge number={member.member_number} label={t("Write on the hand")} />
          </div>
          {member.photos.dress_today && <Image className="dress-photo-preview" src={member.photos.dress_today} alt={`${member.name} today's outfit`} width={356} height={170} unoptimized />}
          <label className={`button button-outline dress-upload ${busyMember === member.id ? "is-uploading" : ""}`}>
            <input
              type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
              disabled={busyMember !== null}
              onChange={(event) => { void upload(member, event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}
            />
            {busyMember === member.id ? t("Photo uploading...") : member.photos.dress_today ? t("Retake photo") : t("Take dress photo")}
          </label>
        </motion.article>
      ))}
      {message && <div className="alert alert-info" role="status">{message}</div>}
      <p className="fine-print">{t("Make sure the photo is in focus and the child's face is visible.")}</p>
    </div>
  );
}

function MissingScreen({ family, onReported }: {
  family: FamilyRecord;
  onReported: (memberId: string) => void;
}) {
  const { t } = useLanguage();
  const [memberId, setMemberId] = useState(family.members[0]?.id ?? "");
  const [ghat, setGhat] = useState(ghats[0]);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const selected = family.members.find((member) => member.id === memberId);

  async function report() {
    if (!memberId) return;
    setError("");
    setBusy(true);
    setShake(true);
    window.setTimeout(() => setShake(false), 350);
    try {
      const response = await fetch("/api/missing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, ghat }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Missing report could not be sent.");
      onReported(memberId);
      setSearching(true);
    } catch (cause) {
      setError(messageFrom(cause, t));
    } finally {
      setBusy(false);
    }
  }

  if (searching || selected?.status === "missing") {
    return (
      <motion.div className="searching-card" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="search-pulse"><span /></div>
        <p className="eyebrow">{t("Volunteers alerted")}</p>
        <h2>{t("Searching...")}</h2>
        <p>{t("Volunteers have been alerted about {name}. Keep your phone nearby.", { name: selected?.name ?? "" })}</p>
        {selected && <NumberBadge number={selected.member_number} label={t("Member number")} />}
        <div className="searching-status"><span className="live-dot" /> {t("Missing report active")}</div>
      </motion.div>
    );
  }
  return (
    <motion.div className="missing-flow" animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}>
      <div className="urgent-note">{t("Stay calm. Show the number slip to volunteers and report here.")}</div>
      <label className="field">
        <span>{t("Who is missing?")} <small>{t("Select member")}</small></span>
        <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
          {family.members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.member_number}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{t("Last seen ghat")}</span>
        <select value={ghat} onChange={(event) => setGhat(event.target.value)}>
          {ghats.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      {selected && <MemberCard family={family} member={selected} secretHint="" compact />}
      <motion.button
        className="button button-danger missing-button" type="button" onClick={() => void report()}
        disabled={busy || !selected}
        whileTap={{ scale: 0.97 }} animate={busy ? { scale: [1, 1.025, 1] } : { scale: 1 }}
      >
        {busy ? t("Sending alert...") : t("MISSING — Report missing")}
      </motion.button>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <p className="fine-print">{t("After reporting, the member number will appear on the volunteer dashboard.")}</p>
    </motion.div>
  );
}

function FoundBoard() {
  const { t } = useLanguage();
  const [records, setRecords] = useState<FoundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/found", { cache: "no-store" });
      const body = await response.json() as { found?: FoundRecord[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Found board could not be loaded.");
      setRecords(body.found ?? []);
    } catch (cause) {
      setError(messageFrom(cause, t));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/found", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { found?: FoundRecord[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Found board could not be loaded.");
        if (!controller.signal.aborted) setRecords(body.found ?? []);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(messageFrom(cause, t));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [t]);

  return (
    <div className="screen-stack">
      <div className="found-board-header">
        <span className="board-seal">PS</span>
        <div><h2>{t("Safe reunions")}</h2><p>{t("Found board · Names & phone numbers private")}</p></div>
      </div>
      {loading && <div className="empty-note">{t("Board loading...")}</div>}
      {!loading && !error && !records.length && <div className="empty-note">{t("No found reports yet. This board updates automatically.")}</div>}
      {error && <div className="alert alert-error" role="alert">{t(error)}<button className="text-button" onClick={() => void refresh()}>{t("Retry")}</button></div>}
      {records.map((record, index) => (
        <motion.article key={`${record.memberNumber}-${record.foundAt}`} className="found-record" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
          {record.photoUrl ? <Image src={record.photoUrl} alt={t("Member number") + ` ${record.memberNumber}`} width={51} height={58} unoptimized /> : <div className="found-photo-placeholder">PS</div>}
          <div><span className="number-mono">{record.memberNumber}</span><p>{t("safe at {ghat}", { ghat: record.ghat })}</p></div>
          <span className="found-tick" aria-label={t("Found")}>✓</span>
        </motion.article>
      ))}
      <p className="privacy-note">{t("The public board shows only the number, photo and ghat. Names and phone numbers are private.")}</p>
    </div>
  );
}

function Celebration({ family, onClose }: { family: FamilyRecord; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <motion.div className="celebration-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="confetti-field" aria-hidden="true">
        {Array.from({ length: 28 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}
      </div>
      <motion.section className="celebration-card" initial={{ y: 30, scale: 0.94 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", damping: 17 }}>
        <span className="celebration-stamp">{t("REGISTERED")}</span>
        <p className="eyebrow">{t("Your family has been registered safely")}</p>
        <h2>{t("Numbers ready!")}</h2>
        <motion.div className="number-mono reveal-number" initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ delay: 0.25, duration: 0.55 }}>
          {family.family_number}
        </motion.div>
        <div className="celebration-members">
          {family.members.map((member, index) => (
            <motion.div key={member.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 + index * 0.12 }}>
              <span>{member.name}</span><strong className="number-mono">{member.member_number}</strong>
            </motion.div>
          ))}
        </div>
        <button className="button button-primary" type="button" onClick={onClose}>{t("Download slips")}</button>
      </motion.section>
    </motion.div>
  );
}

export default function HomePage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("family");
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState("");
  const [family, setFamily] = useState<FamilyRecord | null>(null);
  const [secretHint, setSecretHint] = useState("•••");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [configError, setConfigError] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);

  useEffect(() => {
    let active = true;
    void authClient.getSession().then(({ data, error }) => {
      if (error) throw new Error(error.message);
      if (active) {
        const user = data?.user;
        const hasVerifiedIdentity = Boolean(user?.emailVerified);
        setSignedIn(hasVerifiedIdentity);
        setSignedInEmail(user?.emailVerified ? user.email : "");
        setAuthReady(true);
        if (!hasVerifiedIdentity) setLoading(false);
      }
    }).catch((cause: unknown) => {
      if (active) {
        setConfigError(messageFrom(cause, t));
        setAuthReady(true);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [t]);

  useEffect(() => {
    if (!authReady) return;
    if (!signedIn) return;

    let active = true;
    void fetch("/api/family", { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { family?: FamilyRecord | null; secretHint?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Family details could not be loaded.");
      if (active) {
        setFamily(body.family ?? null);
        if (body.secretHint) setSecretHint(body.secretHint);
      }
    }).catch((cause: unknown) => {
      if (active) setConfigError(messageFrom(cause, t));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [authReady, signedIn, t]);

  const childrenCount = useMemo(() => family?.members.filter((member) => member.age < 18).length ?? 0, [family]);
  const visibleConfigError = configError;

  function updateMemberStatus(memberId: string, status: MemberRecord["status"]) {
    setFamily((current) => current ? {
      ...current,
      members: current.members.map((member) => member.id === memberId ? { ...member, status } : member),
    } : current);
  }

  async function signOut() {
    const { error } = await authClient.signOut();
    if (error) {
      setConfigError(t(error.message ?? "Could not sign out. Please try again."));
      return;
    }
    setFamily(null);
    setSecretHint("•••");
    setSignedInEmail("");
    setShowPasswordSetup(false);
    setSignedIn(false);
  }

  return (
    <div className="app-shell">
      <div className="top-gold-rule" />
      <header className="app-header">
        <div className="trust-mark">PS</div>
        <div className="brand-lockup"><strong>Pushkar Suraksha</strong><span>{t("Pushkaram · Andhra Pradesh")}</span></div>
        <div className="header-actions">
          {signedIn && <button className="text-button" type="button" onClick={() => void signOut()}>{t("Sign out")}</button>}
          <Link className="volunteer-link" href="/volunteer">{t("Volunteer login")}{" "}<span aria-hidden="true">→</span></Link>
        </div>
      </header>
      <div className="festival-strip"><span>{t("GODAVARI PUSHKARAM")}</span></div>
      <div className="language-bar"><LanguageSwitcher /></div>
      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} className="screen-transition" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3, ease: "easeOut" }}>
            {activeTab === "family" && (
              <>
                <div className="page-heading">
                  <p className="eyebrow">{t(family ? "FAMILY SAFETY RECORD" : "FAMILY REGISTRATION")}</p>
                  <h1>{family ? `${family.family_name}` : t("Register your family")}</h1>
                  <p>{family ? t("Print the numbers on the slips and keep one with each family member.") : t("Add each family member to create numbered slips.")}</p>
                </div>
                {loading && <div className="empty-note">{t("Secure family details are loading...")}</div>}
                {visibleConfigError && <div className="alert alert-error" role="alert"><strong>{t("App setup needed")}</strong><br />{t(visibleConfigError)}</div>}
                {authReady && !signedIn && !visibleConfigError && (
                  <AccountSignIn
                    allowPassword
                    allowSignUp
                    onAuthenticated={(account) => {
                      setConfigError("");
                      setLoading(true);
                      setSignedInEmail(account.email ?? "");
                      setSignedIn(true);
                    }}
                  />
                )}
                {signedIn && signedInEmail && (
                  <div className="family-password-setup">
                    {showPasswordSetup ? (
                      <PasswordResetForm
                        initialEmail={signedInEmail}
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
                {!loading && signedIn && !visibleConfigError && !family && (
                  <RegistrationForm
                    busy={busy}
                    onBusyChange={setBusy}
                    initialPhone=""
                    onRegistered={(record, hint) => { setFamily(record); setSecretHint(hint); setCelebrate(true); }}
                  />
                )}
                {!loading && signedIn && family && (
                  <div className="screen-stack">
                    <div className="family-summary">
                      <NumberBadge number={family.family_number} label={t("Family number · Family no.")} />
                      <div className="summary-meta">
                        <span>{family.district}</span>
                        <a href={`tel:${family.phone}`}>+91 {family.phone}</a>
                        {family.alternative_phone && (
                          <a href={`tel:${family.alternative_phone}`}>{t("Alternative")}: +91 {family.alternative_phone}</a>
                        )}
                      </div>
                    </div>
                    <div className="section-caption"><h2>{t("Member slips")}</h2><span>{family.members.length} {t("members")}</span></div>
                    {family.members.map((member, index) => (
                      <motion.div key={member.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                        <MemberCard family={family} member={member} secretHint={secretHint} />
                      </motion.div>
                    ))}
                    <div className="alert alert-info">{t("Upload dress photos for {count} children on Pushkar day.", { count: childrenCount })}</div>
                    <DeleteFamilyPhotos
                      photoCount={family.members.reduce((total, member) => total + Object.keys(member.photos).length, 0)}
                      onDeleted={() => setFamily((current) => current ? ({
                        ...current,
                        members: current.members.map((member) => ({ ...member, photos: {} })),
                      }) : current)}
                    />
                  </div>
                )}
              </>
            )}
            {activeTab === "dress" && (
              <>
                <div className="page-heading"><p className="eyebrow">{t("PUSHKAR DAY")}</p><h1>{t("Today's dress photo")}</h1><p>{t("Upload today's outfit photo to help volunteers identify children.")}</p></div>
                {family && signedIn ? <DressScreen family={family} onPhotoSaved={(memberId, url) => setFamily((current) => current ? ({
                  ...current,
                  members: current.members.map((member) => member.id === memberId ? { ...member, photos: { ...member.photos, dress_today: url } } : member),
                }) : current)} /> : <div className="empty-note">{loading ? t("Family details are loading...") : signedIn ? t("Complete family registration first.") : t("Use the Family tab to sign in before managing photos.")}</div>}
              </>
            )}
            {activeTab === "missing" && (
              <>
                <div className="page-heading"><p className="eyebrow eyebrow-red">{t("URGENT · FAMILY HELP")}</p><h1>{t("Who is missing?")}</h1><p>{t("Select the number and last-seen ghat to alert volunteers.")}</p></div>
                {family && signedIn ? <MissingScreen family={family} onReported={(memberId) => updateMemberStatus(memberId, "missing")} /> : <div className="empty-note">{loading ? t("Family details are loading...") : signedIn ? t("Register your family before reporting.") : t("Use the Family tab to sign in before reporting a missing member.")}</div>}
              </>
            )}
            {activeTab === "found" && (
              <>
                <div className="page-heading"><p className="eyebrow">{t("PUBLIC FOUND BOARD")}</p><h1>{t("Safe reunions")}</h1><p>{t("Only member number, photo and ghat are shared.")}</p></div>
                <FoundBoard />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <nav className="bottom-nav" aria-label={t("Main navigation")}>
        {([
          ["family", "Family"],
          ["dress", "Dress photo"],
          ["missing", "Missing"],
          ["found", "Found board"],
        ] as [Tab, string][]).map(([tab, title]) => (
          <button key={tab} type="button" className={`nav-item ${activeTab === tab ? "is-active" : ""}`} onClick={() => setActiveTab(tab)}>
            {activeTab === tab && <motion.span className="nav-indicator" layoutId="nav-indicator" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <NavIcon type={tab} /><span>{t(title)}</span>
          </button>
        ))}
      </nav>
      <footer className="app-footer">Pushkar Suraksha</footer>
      <AnimatePresence>{celebrate && family && <Celebration family={family} onClose={() => setCelebrate(false)} />}</AnimatePresence>
      {busy && <div className="uploading-banner" role="status"><span className="uploading-line" /> {t("Uploading photos securely...")}</div>}
    </div>
  );
}
