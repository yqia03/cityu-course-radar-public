"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MaterialsAdmin } from "./materials-admin";
import { materialMessage } from "@/lib/material-messages";
import { useRadar } from "./radar-provider";
import { api, errorKey } from "@/lib/client";
import type { MessageKey } from "@/lib/messages";
type Report = {
  id: string;
  reviewId: string;
  reason: string;
  comment: string;
  courseCode: string;
  createdAt: string;
  status: string;
};
export function Moderation() {
  const { t, locale, session, sessionReady } = useRadar();
  const [reports, setReports] = useState<Report[]>([]),
    [error, setError] = useState<MessageKey | null>(null),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false),
    [reasons, setReasons] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!session?.user?.isAdmin) return;
    api<{ reports: Report[] }>("/api/admin/reports")
      .then((r) => {
        setReports(r.reports);
        setError(null);
      })
      .catch((e) => setError(errorKey(e)));
  }, [session, reload]);
  async function act(reviewId: string, action: string) {
    setBusy(true);
    try {
      await api("/api/admin/reviews", {
        reviewId,
        action,
        reason: reasons[reviewId] || "",
      });
      setReload((r) => r + 1);
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="shell about-shell">
      <h1>{t("admin")}</h1>
      {!sessionReady ? (
        <p>{t("loading")}</p>
      ) : !session?.user?.isAdmin ? (
        <p role="alert">{t("FORBIDDEN")}</p>
      ) : (
        <>
          {error && <p role="alert">{t(error)}</p>}
          {reports.length ? (
            reports.map((r) => (
              <article className="content-card" key={r.id}>
                <a href={`/courses/${r.courseCode}`}>{r.courseCode}</a>
                <p className="review-comment">{r.comment}</p>
                <blockquote>{r.reason}</blockquote>
                <label
                  className="field-label"
                  htmlFor={`review-moderation-${r.id}`}
                >
                  {materialMessage("adminReason", locale)}
                </label>
                <Textarea
                  id={`review-moderation-${r.id}`}
                  minLength={5}
                  maxLength={500}
                  value={reasons[r.reviewId] || ""}
                  onChange={(e) =>
                    setReasons((v) => ({ ...v, [r.reviewId]: e.target.value }))
                  }
                />
                <div className="pagination-row">
                  <Button
                    disabled={
                      busy || (reasons[r.reviewId] || "").trim().length < 5
                    }
                    onClick={() => act(r.reviewId, "hide")}
                  >
                    {t("hide")}
                  </Button>
                  <Button
                    disabled={
                      busy || (reasons[r.reviewId] || "").trim().length < 5
                    }
                    variant="outline"
                    onClick={() => act(r.reviewId, "dismiss")}
                  >
                    {t("dismiss")}
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <p>{t("emptyReports")}</p>
          )}
          <MaterialsAdmin />
        </>
      )}
    </main>
  );
}
