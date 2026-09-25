"use client";
import Link from "next/link";
import { useEffect, useState, useRef, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  MessageSquare,
  Flag,
  Check,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useRadar } from "./radar-provider";
import { Department } from "./course-browser";
import { ExternalReviews } from "./external-reviews";
import { MaterialsLibrary } from "./materials-library";
import { materialMessage } from "@/lib/material-messages";
import { api, errorKey } from "@/lib/client";
import {
  chineseTitle,
  description,
  overall,
  type CourseResult,
  type Review,
} from "@/lib/types";
import type { MessageKey } from "@/lib/messages";
type Reviews = {
  reviews: Review[];
  own: Review | null;
  total: number;
  page: number;
};
export function CourseDetail({ code }: { code: string }) {
  const { t, locale, sessionReady, session, refreshSession } = useRadar();
  const [tab, setTab] = useState<"reviews" | "materials">("reviews");
  const initialized = useRef(false);
  const [course, setCourse] = useState<CourseResult | null>(null),
    [reviews, setReviews] = useState<Reviews | null>(null),
    [error, setError] = useState<MessageKey | null>(null),
    [reload, setReload] = useState(0),
    [page, setPage] = useState(1),
    [form, setForm] = useState({
      usefulness: 0,
      interest: 0,
      difficulty: 0,
      comment: "",
      nickname: "",
      semester: "",
      website: "",
    }),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState<MessageKey | null>(null),
    [saved, setSaved] = useState(false),
    [withdrawn, setWithdrawn] = useState(false),
    [reportId, setReportId] = useState<string | null>(null),
    [reason, setReason] = useState(""),
    [reportError, setReportError] = useState<MessageKey | null>(null),
    [reportSent, setReportSent] = useState(false),
    [reportSaving, setReportSaving] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<CourseResult>(`/api/courses/${code}`),
      api<Reviews>(`/api/courses/${code}/reviews?page=${page}`),
    ])
      .then(([c, r]) => {
        if (!active) return;
        setCourse(c);
        setReviews(r);
        setError(null);
        if (!initialized.current) {
          if (r.own) setForm((f) => ({ ...f, ...r.own, website: "" }));
          initialized.current = true;
        }
      })
      .catch((e) => {
        if (active) setError(errorKey(e));
      });
    return () => {
      active = false;
    };
  }, [code, page, reload]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await api(`/api/courses/${code}/reviews`, {
        usefulness: form.usefulness,
        interest: form.interest,
        difficulty: form.difficulty,
        comment: form.comment,
        nickname: form.nickname,
        semester: form.semester,
        website: form.website,
      });
      setSaved(true);
      refreshSession();
      setReload((r) => r + 1);
    } catch (e) {
      setSaveError(errorKey(e));
    } finally {
      setSaving(false);
    }
  }
  async function withdraw() {
    if (!window.confirm(t("withdrawConfirm"))) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api(`/api/courses/${code}/reviews`, {}, "DELETE");
      setSaved(false);
      setWithdrawn(true);
      refreshSession();
      setReload((r) => r + 1);
    } catch (e) {
      setSaveError(errorKey(e));
    } finally {
      setSaving(false);
    }
  }
  async function report(e: FormEvent) {
    e.preventDefault();
    setReportSaving(true);
    setReportError(null);
    try {
      await api("/api/reports", { reviewId: reportId, reason });
      setReportSent(true);
    } catch (e) {
      setReportError(errorKey(e));
    } finally {
      setReportSaving(false);
    }
  }
  if (error)
    return (
      <main className="shell error-state" role="alert">
        <p>{t(error)}</p>
        <Button onClick={() => setReload((r) => r + 1)}>{t("retry")}</Button>
        <Link href="/" prefetch={false}>
          {t("back")}
        </Link>
      </main>
    );
  if (!course)
    return (
      <main className="shell" aria-busy="true">
        <Skeleton className="h-44 mb-6" />
        <Skeleton className="h-96" />
      </main>
    );
  return (
    <main className="shell detail-shell">
      <Link className="back-link" href="/" prefetch={false}>
        <ArrowLeft size={16} />
        {t("back")}
      </Link>
      <section className="detail-heading">
        <div>
          <div className="course-meta">
            <strong>{course.code}</strong>
            {course.archived && <span>{t("archived")}</span>}
            <span>
              {t(
                course.source === "community"
                  ? "communityLabel"
                  : "officialLabel",
              )}
            </span>
          </div>
          <h1 lang="en">{course.titleEn}</h1>
          {chineseTitle(course, locale) && (
            <p
              className="detail-translation"
              lang={locale === "zh-Hant" ? "zh-Hant" : "zh-Hans"}
            >
              {chineseTitle(course, locale)}
            </p>
          )}
          <div className="detail-meta">
            <span>
              <Department name={course.department} />
            </span>
            <span>
              {course.credits ?? course.creditsText ?? "—"} {t("credits")}
            </span>
            <span>{t(course.level === "pg" ? "pg" : "ug")}</span>
            <span>{course.academicYear || ""}</span>
          </div>
        </div>
        <div className="detail-score">
          <strong>{course.stats.score?.toFixed(1) || "—"}</strong>
          <span>{t("nativeRating")} / 5</span>
          <small>
            {course.stats.count} {t("reviews")}
          </small>
          <a
            className="review-jump"
            href="#write-review"
            onClick={() => setTab("reviews")}
          >
            <MessageSquare size={16} />
            {t("writeReviewShort")}
          </a>
        </div>
      </section>
      <div
        className="course-tabs detail-tabs"
        role="tablist"
        aria-label={course.code}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const next =
            event.key === "Home"
              ? "reviews"
              : event.key === "End"
                ? "materials"
                : tab === "reviews"
                  ? "materials"
                  : "reviews";
          setTab(next);
          document.getElementById(`${next}-tab`)?.focus();
        }}
      >
        <button
          id="reviews-tab"
          role="tab"
          tabIndex={tab === "reviews" ? 0 : -1}
          aria-selected={tab === "reviews"}
          aria-controls="reviews-panel"
          onClick={() => setTab("reviews")}
          className={tab === "reviews" ? "active" : ""}
        >
          {materialMessage("reviewsTab", locale)}
        </button>
        <button
          id="materials-tab"
          role="tab"
          tabIndex={tab === "materials" ? 0 : -1}
          aria-selected={tab === "materials"}
          aria-controls="materials-panel"
          onClick={() => setTab("materials")}
          className={tab === "materials" ? "active" : ""}
        >
          {materialMessage("materials", locale)}
        </button>
      </div>
      <div
        id="materials-panel"
        role="tabpanel"
        aria-labelledby="materials-tab"
        hidden={tab !== "materials"}
      >
        <MaterialsLibrary code={code} />
      </div>
      <div
        className="detail-grid"
        id="reviews-panel"
        role="tabpanel"
        aria-labelledby="reviews-tab"
        hidden={tab !== "reviews"}
      >
        <section>
          <article className="content-card">
            <h2>{t("overview")}</h2>
            <p className="description-text">
              {description(course, locale) || t("noDescription")}
            </p>
            {locale !== "en" && (
              <>
                <p className="translation-note">
                  {course.titleZhHans ? t("translation") : t("noChinese")}
                </p>
                <details>
                  <summary>{t("englishOriginal")}</summary>
                  <p className="description-text">
                    {course.descriptionEn || t("noDescription")}
                  </p>
                </details>
              </>
            )}
            <a
              href={course.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              {t("official")}
              <ArrowUpRight size={15} />
            </a>
          </article>
          <ExternalReviews reviews={course.externalReviews ?? []} />
          <section className="reviews-section">
            <h2>
              <MessageSquare size={21} />
              {t("allReviews")}
              <span>{reviews?.total || 0}</span>
            </h2>
            {!reviews?.reviews.length ? (
              <div className="content-card no-reviews">
                <Star size={27} />
                <p>{t("noReviews")}</p>
              </div>
            ) : (
              reviews.reviews.map((r) => (
                <article key={r.id} className="review-card">
                  <div className="review-header">
                    <div className="avatar">
                      {(r.nickname || t("anonymous")).slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{r.nickname || t("anonymous")}</strong>
                      <p>
                        {r.semester && `${r.semester} · `}
                        {new Date(r.updatedAt).toLocaleDateString(locale)}
                      </p>
                    </div>
                    <span className="review-score">
                      {overall(r).toFixed(1)}
                      <small> / 5</small>
                    </span>
                  </div>
                  <div className="review-dimensions">
                    {(["usefulness", "interest", "difficulty"] as const).map(
                      (k) => (
                        <span key={k}>
                          {t(k)} <b>{r[k]}</b>
                        </span>
                      ),
                    )}
                  </div>
                  {r.comment && <p className="review-comment">{r.comment}</p>}
                  <div className="review-actions">
                    {r.mine ? (
                      <span>
                        <Check size={13} />
                        {t("yours")}
                      </span>
                    ) : (
                      <span />
                    )}
                    <button
                      onClick={() => {
                        setReportId(r.id);
                        setReason("");
                        setReportError(null);
                        setReportSent(false);
                      }}
                    >
                      <Flag size={13} />
                      {t("report")}
                    </button>
                  </div>
                </article>
              ))
            )}
            {reviews && reviews.total > 20 && (
              <div className="pagination-row">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("previous")}
                </Button>
                <span>
                  {page} / {Math.ceil(reviews.total / 20)}
                </span>
                <Button
                  variant="outline"
                  disabled={page * 20 >= reviews.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("next")}
                </Button>
              </div>
            )}
          </section>
        </section>
        <aside className="review-aside">
          <form id="write-review" className="review-form" onSubmit={submit}>
            <span className="note-kicker">
              <Star size={16} />
              {t("anonymousHint")}
            </span>
            <h2>{t(reviews?.own ? "editReview" : "writeReview")}</h2>
            {sessionReady && !session?.user && (
              <p className="review-points-hint">
                {materialMessage("reviewRewardHint", locale)}
              </p>
            )}
            {(["usefulness", "interest", "difficulty"] as const).map((k) => (
              <fieldset key={k}>
                <legend>{t(k)}</legend>
                <p className="rating-hint">{t(`${k}Hint`)}</p>
                <RadioGroup
                  className="rating-buttons"
                  aria-label={t(k)}
                  value={String(form[k])}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, [k]: Number(v) }))
                  }
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} data-checked={form[k] === n}>
                      <RadioGroupItem value={String(n)} className="sr-only" />
                      {n}
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>
            ))}
            <label className="field-label" htmlFor="nickname">
              {t("nickname")}
            </label>
            <Input
              id="nickname"
              value={form.nickname}
              maxLength={30}
              onChange={(e) =>
                setForm((f) => ({ ...f, nickname: e.target.value }))
              }
            />
            <label className="field-label" htmlFor="semester">
              {t("semester")}
            </label>
            <Input
              id="semester"
              value={form.semester}
              placeholder={t("semesterPlaceholder")}
              maxLength={40}
              onChange={(e) =>
                setForm((f) => ({ ...f, semester: e.target.value }))
              }
            />
            <label className="field-label" htmlFor="comment">
              {t("comment")}
            </label>
            <Textarea
              id="comment"
              value={form.comment}
              placeholder={t("commentPlaceholder")}
              rows={6}
              onChange={(e) =>
                setForm((f) => ({ ...f, comment: e.target.value }))
              }
            />
            <label className="honeypot" aria-hidden="true">
              Website
              <Input
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) =>
                  setForm((f) => ({ ...f, website: e.target.value }))
                }
              />
            </label>
            {saveError && (
              <p role="alert" className="form-error">
                {t(saveError)}
              </p>
            )}
            {withdrawn && (
              <p role="status" className="form-success">
                {t("withdrawn")}
              </p>
            )}
            {saved && (
              <p role="status" className="form-success">
                {t("saved")}
              </p>
            )}
            <Button
              className="full-width"
              type="submit"
              disabled={
                saving ||
                withdrawn ||
                !reviews ||
                !sessionReady ||
                !session?.canReview ||
                !form.usefulness ||
                !form.interest ||
                !form.difficulty
              }
            >
              {t(saving ? "saving" : reviews?.own ? "update" : "submit")}
            </Button>
            {reviews?.own && (
              <Button
                type="button"
                variant="outline"
                className="full-width mt-3"
                disabled={saving}
                onClick={withdraw}
              >
                {t("withdraw")}
              </Button>
            )}
            <p className="review-policy">{t("reviewNote")}</p>
            <p className="review-policy">
              {materialMessage("reviewExperience", locale)}
            </p>
          </form>
        </aside>
      </div>
      <Dialog
        open={!!reportId}
        onOpenChange={(v) => {
          if (!v) setReportId(null);
        }}
      >
        <DialogContent className="review-dialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("reportTitle")}</DialogTitle>
            <DialogDescription>{t("reportHelp")}</DialogDescription>
          </DialogHeader>
          {reportSent ? (
            <p role="status" className="form-success">
              {t("reportSent")}
            </p>
          ) : (
            <form onSubmit={report}>
              <label htmlFor="report-reason" className="field-label">
                {t("reportReason")}
              </label>
              <Textarea
                id="report-reason"
                minLength={5}
                maxLength={500}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              {reportError && (
                <p role="alert" className="form-error">
                  {t(reportError)}
                </p>
              )}
              <Button
                className="mt-4"
                disabled={reportSaving || !session?.canReview}
                type="submit"
              >
                {t(reportSaving ? "saving" : "report")}
              </Button>
            </form>
          )}
          <DialogClose asChild>
            <Button variant="outline">{t("close")}</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </main>
  );
}
