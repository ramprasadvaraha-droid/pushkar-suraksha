"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";

interface DeleteFamilyPhotosProps {
  photoCount: number;
  onDeleted: () => void;
}

export function DeleteFamilyPhotos({ photoCount, onDeleted }: DeleteFamilyPhotosProps) {
  const { t } = useLanguage();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function deletePhotos() {
    if (!confirmed || busy || photoCount === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/family/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const body = await response.json() as { deleted?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Photos could not be deleted. Please try again.");
      setMessage(body.deleted === 1 ? t("photo permanently deleted.") : t("{count} photos permanently deleted.", { count: body.deleted ?? 0 }));
      setConfirmed(false);
      onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Photos could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="photo-delete-panel" aria-labelledby="photo-delete-heading">
      <h2 id="photo-delete-heading">{t("Delete family photos")}</h2>
      <p>{t("Delete all {count} stored family photos, including today's dress photos. Family and member records will remain. Volunteers will no longer be able to use deleted photos to identify members. Photos are set to expire on September 30, 2027 at 11:59 PM IST.", { count: photoCount })}</p>
      <label className="photo-delete-checkbox">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy || photoCount === 0}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>
          {t("I understand this permanently removes the stored photos. It cannot remove copies already saved on a device.")}
        </span>
      </label>
      {error && <p className="alert alert-error" role="alert">{t(error)}</p>}
      {message && <p className="alert alert-info" role="status">{message}</p>}
      {photoCount === 0 && !message && <p className="privacy-note">{t("No family photos are currently stored.")}</p>}
      <button
        className="button button-danger photo-delete-button"
        type="button"
        disabled={!confirmed || busy || photoCount === 0}
        onClick={() => void deletePhotos()}
      >
        {busy ? t("Deleting photos...") : t("Delete all photos")}
      </button>
    </section>
  );
}
