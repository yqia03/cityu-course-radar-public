"use client";
import { useRadar } from "./radar-provider";
const privacy = [
  "privacyBody1",
  "privacyBody2",
  "privacyBody3",
  "privacyBody4",
  "privacyBody5",
] as const;
const terms = ["termsBody1", "termsBody2", "termsBody3", "termsBody4"] as const;
export function Policy({
  kind,
  contact,
}: {
  kind: "privacy" | "terms";
  contact?: string;
}) {
  const { t } = useRadar();
  return (
    <main className="shell about-shell">
      <h1>{t(kind)}</h1>
      <section className="content-card">
        {(kind === "privacy" ? privacy : terms).map((key) => (
          <p key={key}>{t(key)}</p>
        ))}
        {contact && (
          <p>
            {t("contactOperator")}
            <a href={`mailto:${contact}`}>{contact}</a>
          </p>
        )}
        <p>2026-09-24</p>
      </section>
    </main>
  );
}
