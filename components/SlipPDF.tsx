"use client";

import { useState } from "react";
import type { FamilyRecord, MemberRecord } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

export function SlipPDF({ family, member, secretHint }: {
  family: FamilyRecord;
  member: MemberRecord;
  secretHint: string;
}) {
  const { t } = useLanguage();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setWorking(true);
    setError("");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a6" });
      pdf.setFillColor(255, 248, 231);
      pdf.rect(0, 0, 105, 148, "F");
      pdf.setDrawColor(122, 28, 28);
      pdf.setLineWidth(1);
      pdf.rect(5, 5, 95, 138);
      pdf.setTextColor(122, 28, 28);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text("PUSHKAR SURAKSHA", 52.5, 17, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text("FAMILY SAFETY IDENTIFICATION SLIP", 52.5, 23, { align: "center" });
      const photo = member.photos.face_front;
      if (photo) {
        const response = await fetch(photo);
        if (!response.ok) throw new Error("Photo link expired. Refresh the family page and try again.");
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        const scale = Math.min(1, 700 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          bitmap.close();
          throw new Error("Could not prepare the photo for printing.");
        }
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const image = canvas.toDataURL("image/jpeg", 0.9);
        const drawWidth = 35 * Math.min(canvas.width / canvas.height, 1);
        const drawHeight = 35 * Math.min(canvas.height / canvas.width, 1);
        pdf.addImage(image, "JPEG", 52.5 - drawWidth / 2, 29 + (35 - drawHeight) / 2, drawWidth, drawHeight, undefined, "FAST");
      }
      pdf.setTextColor(26, 26, 26);
      pdf.setFontSize(10);
      pdf.text(member.name, 52.5, 71, { align: "center" });
      pdf.setFontSize(8);
      pdf.text(`${member.relation}  |  Age ${member.age}`, 52.5, 77, { align: "center" });
      pdf.setDrawColor(218, 183, 112);
      pdf.line(13, 82, 92, 82);
      pdf.setFont("courier", "bold");
      pdf.setFontSize(12);
      pdf.text(family.family_number, 52.5, 91, { align: "center" });
      pdf.setFontSize(15);
      pdf.text(member.member_number, 52.5, 102, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Parent phone: ${family.phone}`, 13, 113);
      pdf.text(`Secret hint: ${secretHint}`, 13, 120);
      pdf.setFontSize(7);
      pdf.text("Keep this slip with the member during Pushkaram.", 52.5, 132, { align: "center" });
      pdf.save(`${member.member_number}-pushkar-suraksha.pdf`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF could not be created.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <button className="button button-outline button-small" type="button" onClick={() => void download()} disabled={working}>
        {working ? t("PDF is being prepared...") : t("Member slip PDF")}
      </button>
      {error && <span className="field-error">{t(error)}</span>}
    </div>
  );
}
