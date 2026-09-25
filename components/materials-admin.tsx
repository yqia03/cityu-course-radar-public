"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRadar } from "./radar-provider";
import { api } from "@/lib/client";
import {
  materialError,
  materialMessage,
  materialStatus,
  type MaterialMessageKey,
} from "@/lib/material-messages";
import { formatBytes, type Material } from "./materials-library";

type AdminMaterial = Material & {
  courseCode: string;
  ownerId: string;
  uploaderAccountId: string;
  versions: NonNullable<Material["versions"]>;
};
type Usage = {
  heldBytes: number;
  capacityBytes: number;
  uploadsEnabled: boolean;
  bucketAvailable: boolean;
  reconciledAt: string | null;
};
type AdminResponse = {
  materials: AdminMaterial[];
  reports: {
    id: string;
    materialId: string;
    reason: string;
    status: string;
    createdAt: string;
  }[];
  audit: {
    id: string;
    action: string;
    material_id: string | null;
    reason: string;
    created_at: string;
  }[];
  usage: Usage;
  page: number;
  hasMore: boolean;
};
type Reconciliation = {
  released: number;
  orphans: number;
  orphanBytes: number;
  uncertainUploads: { id: string; heldBytes: number; expiresAt: number }[];
  nextCursor: string | null;
};

export function MaterialsAdmin() {
  const { locale, session, refreshSession } = useRadar();
  const m = (key: MaterialMessageKey) => materialMessage(key, locale);
  const [data, setData] = useState<AdminResponse | null>(null);
  const [error, setError] = useState<MaterialMessageKey | null>(null);
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState<MaterialMessageKey | null>(null);
  const [report, setReport] = useState<Reconciliation | null>(null);
  useEffect(() => {
    if (!session?.user?.isAdmin) return;
    let active = true;
    api<AdminResponse>(`/api/admin/materials?page=${page}`)
      .then((result) => {
        if (!active) return;
        setData(result);
        setCapacity(String(result.usage.capacityBytes));
        setError(null);
      })
      .catch((e) => {
        if (active) setError(materialError(e));
      });
    return () => {
      active = false;
    };
  }, [session, reload, page]);
  async function operation(body: object) {
    if (reason.trim().length < 10) {
      setError("INVALID_INPUT");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const result = await api<Reconciliation>(
        "/api/admin/materials/operations",
        { ...body, reason },
      );
      if ("released" in result) setReport(result);
      setStatus("saved");
      setReload((v) => v + 1);
    } catch (e) {
      setError(materialError(e));
    } finally {
      setBusy(false);
    }
  }
  if (!session?.user?.isAdmin) return null;
  return (
    <section
      className="materials-admin"
      aria-labelledby="materials-admin-heading"
    >
      <h2 id="materials-admin-heading">{m("adminMaterials")}</h2>
      {error && (
        <p className="form-error" role="alert">
          {m(error)}{" "}
          <Button variant="outline" onClick={() => setReload((v) => v + 1)}>
            {m("retry")}
          </Button>
        </p>
      )}
      {!data && !error && <p role="status">{m("loading")}</p>}
      {data && (
        <>
          <section className="content-card">
            <h3>{m("usage")}</h3>
            <dl className="material-usage">
              <div>
                <dt>{m("storageUsed")}</dt>
                <dd>{formatBytes(data.usage.heldBytes, locale)}</dd>
              </div>
              <div>
                <dt>{m("storageLimit")}</dt>
                <dd>{formatBytes(data.usage.capacityBytes, locale)}</dd>
              </div>
              <div>
                <dt>{m("lastReconciled")}</dt>
                <dd>
                  {data.usage.reconciledAt
                    ? new Date(data.usage.reconciledAt).toLocaleString(locale)
                    : "—"}
                </dd>
              </div>
            </dl>
            <p className="materials-notice">
              {m(
                data.usage.bucketAvailable
                  ? "bucketAvailable"
                  : "bucketUnavailable",
              )}
            </p>
            <p>{m("usageNote")}</p>
            <label htmlFor="materials-capacity" className="field-label">
              {m("storageLimit")}
            </label>
            <Input
              id="materials-capacity"
              type="number"
              min={0}
              max={8_000_000_000}
              step={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            <p className="materials-note">{m("capacityHelp")}</p>
            <label
              htmlFor="materials-operations-reason"
              className="field-label"
            >
              {m("adminReason")}
            </label>
            <Textarea
              id="materials-operations-reason"
              required
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="material-actions">
              <Button
                disabled={
                  busy ||
                  reason.trim().length < 10 ||
                  !Number.isSafeInteger(Number(capacity)) ||
                  Number(capacity) < 0 ||
                  Number(capacity) > 8_000_000_000
                }
                onClick={() =>
                  operation({
                    action: "settings",
                    uploadsEnabled: data.usage.uploadsEnabled,
                    capacityBytes: Number(capacity),
                  })
                }
              >
                {m("save")}
              </Button>
              <Button
                variant="outline"
                disabled={
                  busy ||
                  reason.trim().length < 10 ||
                  (!data.usage.uploadsEnabled && !data.usage.bucketAvailable)
                }
                onClick={() =>
                  operation({
                    action: "settings",
                    uploadsEnabled: !data.usage.uploadsEnabled,
                    capacityBytes: Number(capacity),
                  })
                }
              >
                {m(data.usage.uploadsEnabled ? "pause" : "resume")}
              </Button>
              <Button
                variant="outline"
                disabled={
                  busy ||
                  reason.trim().length < 10 ||
                  !data.usage.bucketAvailable
                }
                onClick={() =>
                  operation({
                    action: "reconcile",
                    ...(report?.nextCursor
                      ? { cursor: report.nextCursor }
                      : {}),
                  })
                }
              >
                {m(report?.nextCursor ? "continueReconcile" : "reconcile")}
              </Button>
            </div>
            <p className="materials-note">{m("reconcileNote")}</p>
            {status && (
              <p className="form-success" role="status">
                {m(status)}
              </p>
            )}
            {report && (
              <div className="material-reconcile-result" role="status">
                <p>{m("reconcileComplete")}</p>
                <dl className="material-usage">
                  <div>
                    <dt>{m("released")}</dt>
                    <dd>{report.released}</dd>
                  </div>
                  <div>
                    <dt>{m("orphans")}</dt>
                    <dd>
                      {report.orphans} ·{" "}
                      {formatBytes(report.orphanBytes, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt>{m("uncertainUploads")}</dt>
                    <dd>{report.uncertainUploads.length}</dd>
                  </div>
                </dl>
                {report.uncertainUploads.map((upload) => (
                  <p key={upload.id}>
                    <code>{upload.id}</code> ·{" "}
                    {formatBytes(upload.heldBytes, locale)}
                  </p>
                ))}
              </div>
            )}
          </section>
          <section>
            <h3>{m("queue")}</h3>
            {(page > 1 || data.hasMore) && (
              <nav className="pagination-row" aria-label={m("queue")}>
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  {m("previous")}
                </Button>
                <span>{page}</span>
                <Button
                  variant="outline"
                  disabled={!data.hasMore}
                  onClick={() => setPage((v) => v + 1)}
                >
                  {m("next")}
                </Button>
              </nav>
            )}
            {!data.materials.length ? (
              <p>{m("noItems")}</p>
            ) : (
              data.materials.map((item) => (
                <ModerateMaterial
                  key={item.id}
                  item={item}
                  onChanged={() => {
                    setReload((v) => v + 1);
                    refreshSession();
                  }}
                />
              ))
            )}
          </section>
          <section className="content-card">
            <h3>{m("reports")}</h3>
            {!data.reports.length ? (
              <p>{m("noItems")}</p>
            ) : (
              data.reports.map((item) => (
                <ModerateMaterialReport
                  key={item.id}
                  report={item}
                  title={
                    data.materials.find((entry) => entry.id === item.materialId)
                      ?.title ?? item.materialId
                  }
                  onChanged={() => {
                    setReload((v) => v + 1);
                    refreshSession();
                  }}
                />
              ))
            )}
          </section>
          <PointsAdjustment />
          <section className="content-card">
            <h3>{m("audit")}</h3>
            <p className="materials-note">{m("auditScope")}</p>
            {!data.audit.length ? (
              <p>{m("noItems")}</p>
            ) : (
              <ol className="material-audit">
                {data.audit.map((entry) => (
                  <li key={entry.id}>
                    <strong>
                      {(
                        {
                          approve: m("approve"),
                          reject: m("reject"),
                          take_down: m("remove"),
                          restore: m("restore"),
                          recover_upload: m("recoverUpload"),
                          abandon_upload: m("abandoned"),
                          settings: m("usage"),
                          reconcile: m("reconcile"),
                          dismiss_report: m("dismiss"),
                        } as Record<string, string>
                      )[entry.action] ?? entry.action}
                    </strong>
                    <time dateTime={entry.created_at}>
                      {new Date(entry.created_at).toLocaleString(locale)}
                    </time>
                    <p>{entry.reason}</p>
                    {entry.material_id && <code>{entry.material_id}</code>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </section>
  );
}

function ModerateMaterial({
  item,
  onChanged,
}: {
  item: AdminMaterial;
  onChanged: () => void;
}) {
  const { locale } = useRadar();
  const m = (key: MaterialMessageKey) => materialMessage(key, locale);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MaterialMessageKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [checkedAt] = useState(() => Date.now());
  async function act(action: string, versionId?: string) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (action === "recover_upload")
        await api("/api/admin/materials/operations", {
          action,
          uploadId: versionId,
          reason,
        });
      else
        await api("/api/admin/materials", {
          materialId: item.id,
          ...(versionId ? { versionId } : {}),
          action,
          reason,
        });
      setSaved(true);
      onChanged();
    } catch (e) {
      setError(materialError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="material-card">
      <div className="material-meta">
        <a href={`/courses/${item.courseCode}`}>{item.courseCode}</a>
        <span>{m(materialStatus(item.status))}</span>
        <span>
          {item.academicYear} · {item.semester}
        </span>
      </div>
      <h4>{item.title}</h4>
      <p className="materials-note">
        {m("accountId")}: <code>{item.uploaderAccountId}</code>
      </p>
      <p>{item.rightsDeclaration}</p>
      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-link"
        >
          {m("source")}
        </a>
      )}
      <p className="materials-notice">{m("unscanned")}</p>
      <label htmlFor={`moderate-material-${item.id}`} className="field-label">
        {m("adminReason")}
      </label>
      <Textarea
        id={`moderate-material-${item.id}`}
        minLength={10}
        maxLength={1000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {item.versions.map((version) => (
        <div className="material-admin-version" key={version.id}>
          <strong>
            {m("version")} · {m(materialStatus(version.status))}
          </strong>
          <p>
            {new Date(version.createdAt).toLocaleString(locale)} ·{" "}
            {formatBytes(version.size, locale)}
          </p>
          <small>
            {m("checksum")}: <code>{version.sha256 ?? m("notVerified")}</code>
          </small>
          <div className="material-actions">
            {["quarantined", "approved"].includes(version.status) && (
              <Button variant="outline" asChild>
                <a
                  href={`/api/admin/materials/${item.id}/download?versionId=${encodeURIComponent(version.id)}`}
                >
                  {m("reviewFile")}
                </a>
              </Button>
            )}
            {version.status === "uploading" &&
              version.expiresAt * 1000 < checkedAt && (
                <Button
                  variant="outline"
                  disabled={busy || reason.trim().length < 10}
                  onClick={() => act("recover_upload", version.id)}
                >
                  {m("recoverUpload")}
                </Button>
              )}
            {version.status === "quarantined" && (
              <>
                <Button
                  disabled={busy || reason.trim().length < 10}
                  onClick={() => act("approve", version.id)}
                >
                  {m("approve")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || reason.trim().length < 10}
                  onClick={() => act("reject", version.id)}
                >
                  {m("reject")}
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      <div className="material-actions">
        {item.status === "approved" && (
          <Button
            variant="outline"
            disabled={busy || reason.trim().length < 10}
            onClick={() => act("take_down")}
          >
            {m("remove")}
          </Button>
        )}
        {item.status === "taken_down" && (
          <Button
            variant="outline"
            disabled={busy || reason.trim().length < 10}
            onClick={() => act("restore")}
          >
            {m("restore")}
          </Button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {m(error)}
        </p>
      )}
      {saved && (
        <p className="form-success" role="status">
          {m("saved")}
        </p>
      )}
    </article>
  );
}

function PointsAdjustment() {
  const { locale, refreshSession } = useRadar();
  const m = (key: MaterialMessageKey) => materialMessage(key, locale);
  const [form, setForm] = useState({
    accountId: "",
    amount: "",
    reason: "",
    eventId: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MaterialMessageKey | null>(null);
  const [result, setResult] = useState<{ balance: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const eventId = form.eventId || crypto.randomUUID();
    setForm((v) => ({ ...v, eventId }));
    setSubmitted(true);
    try {
      setResult(
        await api("/api/admin/points", {
          ...form,
          eventId,
          amount: Number(form.amount),
        }),
      );
      refreshSession();
    } catch (e) {
      const code = materialError(e);
      setError(code === "NOT_FOUND" ? "ACCOUNT_NOT_FOUND" : code);
      if (["INVALID_INPUT", "NOT_FOUND", "FORBIDDEN"].includes(code)) {
        setSubmitted(false);
        setForm((v) => ({ ...v, eventId: "" }));
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="content-card" onSubmit={submit}>
      <h3>{m("adjustment")}</h3>
      <fieldset disabled={busy || submitted}>
        <label htmlFor="points-account-id" className="field-label">
          {m("accountId")}
        </label>
        <Input
          id="points-account-id"
          required
          value={form.accountId}
          maxLength={255}
          onChange={(e) =>
            setForm((v) => ({ ...v, accountId: e.target.value }))
          }
        />
        <label htmlFor="points-adjustment-amount" className="field-label">
          {m("amount")}
        </label>
        <Input
          id="points-adjustment-amount"
          type="number"
          min={-10000}
          max={10000}
          step={1}
          required
          value={form.amount}
          onChange={(e) => setForm((v) => ({ ...v, amount: e.target.value }))}
        />
        <label htmlFor="points-adjustment-reason" className="field-label">
          {m("adminReason")}
        </label>
        <Textarea
          id="points-adjustment-reason"
          required
          minLength={5}
          maxLength={500}
          value={form.reason}
          onChange={(e) => setForm((v) => ({ ...v, reason: e.target.value }))}
        />
      </fieldset>
      {form.eventId && (
        <p className="materials-note">
          {m("eventId")}: <code>{form.eventId}</code>
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {m(error)}
        </p>
      )}
      {result ? (
        <>
          <p role="status" className="form-success">
            {m("saved")} {m("adjustmentBalance")}: {result.balance}
          </p>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setResult(null);
              setForm({ accountId: "", amount: "", reason: "", eventId: "" });
              setSubmitted(false);
            }}
          >
            {m("newAdjustment")}
          </Button>
        </>
      ) : (
        <Button
          type="submit"
          className="mt-4"
          disabled={busy || !Number(form.amount)}
        >
          {m(submitted ? "retry" : "save")}
        </Button>
      )}
    </form>
  );
}

function ModerateMaterialReport({
  report,
  title,
  onChanged,
}: {
  report: AdminResponse["reports"][number];
  title: string;
  onChanged: () => void;
}) {
  const { locale } = useRadar();
  const m = (key: MaterialMessageKey) => materialMessage(key, locale);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MaterialMessageKey | null>(null);
  async function dismiss(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/materials/operations", {
        action: "dismiss_report",
        reportId: report.id,
        reason,
      });
      onChanged();
    } catch (e) {
      setError(materialError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="material-admin-report">
      <strong>{title}</strong>
      <p>{report.reason}</p>
      <time dateTime={report.createdAt}>
        {new Date(report.createdAt).toLocaleString(locale)}
      </time>
      <form onSubmit={dismiss}>
        <label
          className="field-label"
          htmlFor={`material-report-close-${report.id}`}
        >
          {m("adminReason")}
        </label>
        <Textarea
          id={`material-report-close-${report.id}`}
          required
          minLength={10}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && (
          <p className="form-error" role="alert">
            {m(error)}
          </p>
        )}
        <Button
          type="submit"
          variant="outline"
          className="mt-4"
          disabled={busy || reason.trim().length < 10}
        >
          {m("dismiss")}
        </Button>
      </form>
    </article>
  );
}
