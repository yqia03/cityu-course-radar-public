"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRadar } from "./radar-provider";
import { api } from "@/lib/client";
import {
  materialError,
  materialMessage,
  type MaterialMessageKey,
} from "@/lib/material-messages";

type LedgerEntry = {
  id: string;
  eventKey: string;
  amount: number;
  kind: string;
  referenceId: string | null;
  reason: string;
  createdAt: string;
};
type PointsResponse = {
  balance: number;
  pendingRewards: number;
  ledger: LedgerEntry[];
  page: number;
  total: number;
};
const eventLabels: Record<string, MaterialMessageKey> = {
  first_login: "first_login",
  review_reward: "review_reward",
  review_revoke: "review_reversal",
  material_reward: "upload_reward",
  material_revoke: "upload_reversal",
  upload_reward: "upload_reward",
  upload_revoke: "upload_reversal",
  material_unlock: "unlock_event",
  material_refund: "refund",
  admin_adjustment: "adjustment_event",
};

export function Points() {
  const { locale, session, sessionReady } = useRadar();
  const m = (key: MaterialMessageKey) => materialMessage(key, locale);
  const [data, setData] = useState<PointsResponse | null>(null);
  const [error, setError] = useState<MaterialMessageKey | null>(null);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    api<PointsResponse>(`/api/points?page=${page}`)
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) setError(materialError(e));
      });
    return () => {
      active = false;
    };
  }, [page, reload, session]);

  return (
    <main className="shell about-shell points-shell">
      <Link href="/" prefetch={false} className="back-link">
        <ArrowLeft size={16} />
        CityU Course Radar
      </Link>
      <h1>
        <Coins aria-hidden="true" />
        {m("points")}
      </h1>
      {!sessionReady ? (
        <p role="status">{m("loading")}</p>
      ) : !session?.user ? (
        <Button asChild>
          <a href="/login?returnTo=%2Fpoints">{m("LOGIN_REQUIRED")}</a>
        </Button>
      ) : (
        <>
          {error && (
            <div role="alert" className="form-error">
              {m(error)}{" "}
              <Button variant="outline" onClick={() => setReload((v) => v + 1)}>
                {m("retry")}
              </Button>
            </div>
          )}
          {!data && !error && <p role="status">{m("loading")}</p>}
          {data && (
            <>
              <div className="points-summary">
                <section className="content-card">
                  <h2>{m("balance")}</h2>
                  <strong className="points-value">{data.balance}</strong>
                  {data.balance < 0 && <p role="status">{m("debt")}</p>}
                </section>
                <section className="content-card">
                  <h2>{m("pendingReward")}</h2>
                  <strong className="points-value">
                    {data.pendingRewards}
                  </strong>
                  <p>{m("pendingNote")}</p>
                </section>
              </div>
              <section className="content-card">
                <h2>{m("ledger")}</h2>
                {!data.ledger.length ? (
                  <p>{m("noLedger")}</p>
                ) : (
                  <ol className="points-ledger">
                    {data.ledger.map((entry) => (
                      <li key={entry.id}>
                        <div>
                          <strong>
                            {eventLabels[entry.kind]
                              ? m(eventLabels[entry.kind])
                              : entry.kind}
                          </strong>
                          <time dateTime={entry.createdAt}>
                            {new Date(entry.createdAt).toLocaleString(locale)}
                          </time>
                          {entry.reason &&
                            (entry.kind === "admin_adjustment" ||
                              !eventLabels[entry.kind]) && (
                              <p>{entry.reason}</p>
                            )}
                          <small>{entry.eventKey}</small>
                        </div>
                        <b
                          className={
                            entry.amount > 0 ? "points-credit" : "points-debit"
                          }
                        >
                          {entry.amount > 0 ? "+" : ""}
                          {entry.amount}
                        </b>
                      </li>
                    ))}
                  </ol>
                )}
                {data.total > 20 && (
                  <nav className="pagination-row" aria-label={m("ledger")}>
                    <Button
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((v) => v - 1)}
                    >
                      {m("previous")}
                    </Button>
                    <span>
                      {page} / {Math.ceil(data.total / 20)}
                    </span>
                    <Button
                      variant="outline"
                      disabled={page * 20 >= data.total}
                      onClick={() => setPage((v) => v + 1)}
                    >
                      {m("next")}
                    </Button>
                  </nav>
                )}
              </section>
            </>
          )}
          <section className="content-card">
            <p>{m("pointsRules")}</p>
            <p>{m("pointsLimits")}</p>
          </section>
        </>
      )}
    </main>
  );
}
