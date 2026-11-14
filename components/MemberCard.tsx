import Image from "next/image";
import { NumberBadge } from "@/components/NumberBadge";
import { SlipPDF } from "@/components/SlipPDF";
import { useLanguage } from "@/lib/i18n";
import type { FamilyRecord, MemberRecord } from "@/lib/types";

export function MemberCard({ family, member, secretHint, compact = false }: {
  family: FamilyRecord;
  member: MemberRecord;
  secretHint: string;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <article className={`member-card ${compact ? "member-card-compact" : ""}`}>
      {member.photos.face_front ? (
        <Image className="member-photo" src={member.photos.face_front} alt={t("Face photo of {name}", { name: member.name })} width={72} height={90} unoptimized />
      ) : (
        <div className="member-photo photo-placeholder" aria-hidden="true">PS</div>
      )}
      <div className="member-details">
        <div className="member-title-row">
          <h3>{member.name}</h3>
          <span className={`status-tag status-${member.status}`}>{member.status === "missing" ? t("Search") : t("Safe")}</span>
        </div>
        <p>{t(member.relation)} · {t("Age {age}", { age: member.age })}</p>
        <NumberBadge number={member.member_number} label={t("Write on the hand")} />
        {!compact && (
          <div className="member-actions">
            <SlipPDF family={family} member={member} secretHint={secretHint} />
          </div>
        )}
      </div>
    </article>
  );
}
