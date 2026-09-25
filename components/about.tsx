"use client";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Database,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { useRadar } from "./radar-provider";
import report from "@/data/import-report.json";
export function About() {
  const { t } = useRadar();
  return (
    <main className="shell about-shell">
      <Link className="back-link" href="/" prefetch={false}>
        <ArrowLeft size={16} />
        {t("back")}
      </Link>
      <h1>{t("about")}</h1>
      <section className="content-card">
        <Database />
        <h2>{t("dataTitle")}</h2>
        <p>{t("dataText")}</p>
        <div className="source-stats">
          <strong>{report.uniqueCourses.toLocaleString()}</strong>
          <span>
            {t("courses")} · 2026/27 · {report.fetchedAt.slice(0, 10)}
          </span>
        </div>
        <p className="translation-note">{t("translation")}</p>
        <div className="source-links">
          <a href={report.sources.ug} target="_blank" rel="noreferrer">
            {t("ug")} <ExternalLink size={14} />
          </a>
          <a href={report.sources.pg} target="_blank" rel="noreferrer">
            {t("pg")} <ExternalLink size={14} />
          </a>
        </div>
      </section>
      <section className="content-card">
        <Scale />
        <h2>{t("sourcePolicyTitle")}</h2>
        <p>{t("sourcePolicy")}</p>
      </section>
      <section className="content-card">
        <Scale />
        <h2>{t("formulaTitle")}</h2>
        <div className="formula">{t("formula")}</div>
        <p>{t("formulaHelp")}</p>
      </section>
      <section className="content-card">
        <ShieldCheck />
        <h2>{t("privacyTitle")}</h2>
        <p>{t("privacyText")}</p>
        <p>{t("guidelinesText")}</p>
      </section>
    </main>
  );
}
