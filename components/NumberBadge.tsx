import { useLanguage } from "@/lib/i18n";

export function NumberBadge({ number, label }: { number: string; label?: string }) {
  const { t } = useLanguage();
  return (
    <div className="number-badge">
      <span className="number-badge-label">{label ?? t("Your family number")}</span>
      <strong className="number-mono">{number}</strong>
    </div>
  );
}
