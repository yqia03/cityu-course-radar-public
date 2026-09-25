"use client";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { externalMetricLabel, type ExternalReview } from "@/lib/types";
import { useRadar } from "./radar-provider";

export function ExternalReviews({ reviews }: { reviews: ExternalReview[] }) {
  const { t, locale } = useRadar();
  if (!reviews.length) return null;
  return (
    <section className="external-section" id="external-reviews">
      <h2>
        <BookOpen size={21} />
        {t("externalTitle")}
        <span>{reviews.length}</span>
      </h2>
      <p className="external-explainer">{t("externalHelp")}</p>
      {reviews.map((r) => (
        <article key={r.id} className="external-card">
          <div className="external-source">
            <span className="source-badge">{r.platform}</span>
            <span>{r.author}</span>
          </div>
          <a
            className="external-title"
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {r.sourceTitle}
            <ArrowUpRight size={16} />
          </a>
          <div className="external-dates">
            <span>
              {t("sourceDate")}: {r.publishedAt || t("unknownDate")}
            </span>
            {r.term && <span>{r.term}</span>}
            <span>
              {t("checkedAt")}: {r.checkedAt}
            </span>
          </div>
          {r.ratings.length ? (
            <div className="original-ratings">
              <strong>{t("originalRating")}</strong>
              {r.ratings.map((rating, i) => (
                <div key={i}>
                  <span>
                    {locale === "en"
                      ? `${externalMetricLabel(rating.label, locale)} (${rating.label})`
                      : externalMetricLabel(rating.label, locale)}
                  </span>
                  <b>{rating.value}</b>
                  <small>{rating.scale || t("unspecifiedScale")}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-original-rating">{t("noOriginalRating")}</p>
          )}
          {r.reportedGrade && (
            <p className="reported-grade">
              {t("reportedGrade")}: <b>{r.reportedGrade}</b>
            </p>
          )}
          <p className="external-summary">{r.summary[locale]}</p>
          <p className="external-context">{r.context[locale]}</p>
          <div className="external-footer">
            <span>{t("editorialSummary")}</span>
            <a href={r.url} target="_blank" rel="noopener noreferrer">
              {t("readSource")}
              <ArrowUpRight size={14} />
            </a>
          </div>
        </article>
      ))}
    </section>
  );
}
