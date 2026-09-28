"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Download, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRadar } from "./radar-provider";
import { api } from "@/lib/client";
import {
  officialExamSearchUrl,
  OFFICIAL_EXAM_BROWSE_URL,
} from "@/lib/official-exams";
import {
  materialError,
  materialMessage,
  materialStatus,
  type MaterialMessageKey,
} from "@/lib/material-messages";

export type Material = {
  id: string;
  title: string;
  category: "lecture" | "tutorial" | "past_exam" | "notes";
  academicYear: string;
  semester: string;
  week: number | null;
  createdAt: string;
  rightsBasis: "own" | "permission" | "open_license";
  rightsDeclaration?: string;
  sourceUrl: string;
  status: string;
  currentVersion: { id: string; size: number; sha256: string } | null;
  versions?: {
    id: string;
    status: string;
    size: number;
    sha256: string | null;
    createdAt: string;
    expiresAt: number;
  }[];
  mine: boolean;
  unlocked: boolean;
};
type MaterialCatalogue = {
  materials: Material[];
  uploadsEnabled: boolean;
  maxFileBytes: number;
  officialExamUrl: string;
  scanStatus: string;
  page: number;
  hasMore: boolean;
  filterOptions?: { academicYears: string[]; weeks: number[] };
};
const categories = ["lecture", "tutorial", "past_exam", "notes"] as const;
const rightsKeys = {
  own: "original",
  permission: "permission",
  open_license: "openLicense",
} as const;
export const formatBytes = (bytes: number, locale: string) => {
  const divisor = bytes >= 1_000_000 ? 1_000_000 : bytes >= 1000 ? 1000 : 1;
  const unit = divisor === 1_000_000 ? "MB" : divisor === 1000 ? "KB" : "B";
  return `${(bytes / divisor).toLocaleString(locale, { maximumFractionDigits: 2 })} ${unit}`;
};

async function responseError(response: Response) {
  let code = "UNAVAILABLE";
  try {
    code = ((await response.json()) as { error?: string }).error || code;
  } catch {}
  return new Error(code);
}

export function MaterialsLibrary({ code }: { code: string }) {
  const { locale, session, sessionReady, refreshSession } = useRadar();
  const m = (key: MaterialMessageKey) => materialMessage(key, locale);
  const [data, setData] = useState<MaterialCatalogue | null>(null);
  const [error, setError] = useState<MaterialMessageKey | null>(null);
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    category: "",
    academicYear: "",
    semester: "",
    week: "",
  });
  const [showUpload, setShowUpload] = useState(false);
  const [updating, setUpdating] = useState<Material | null>(null);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page), ...filters });
    api<MaterialCatalogue>(
      `/api/courses/${encodeURIComponent(code)}/materials?${query}`,
    )
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
  }, [code, reload, session?.user?.accountId, page, filters]);
  const visible = data?.materials ?? [];
  const years =
    data?.filterOptions?.academicYears ??
    [...new Set(visible.map((item) => item.academicYear))].sort().reverse();
  const weeks =
    data?.filterOptions?.weeks ??
    [
      ...new Set(
        visible
          .map((item) => item.week)
          .filter((week): week is number => week !== null),
      ),
    ].sort((a, b) => a - b);
  const filter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((v) => ({ ...v, [key]: value }));
  };
  return (
    <section
      className="materials-library"
      id="course-materials"
      aria-labelledby="materials-heading"
    >
      <div className="materials-heading">
        <div>
          <h2 id="materials-heading">
            <FileText aria-hidden="true" size={22} />
            {m("materials")}
          </h2>
          <p>{m("materialsIntro")}</p>
        </div>
        {sessionReady &&
          (session?.user ? (
            <Button
              disabled={!data?.uploadsEnabled}
              onClick={() => {
                setUpdating(null);
                setShowUpload((v) => !v);
              }}
            >
              <Upload size={16} />
              {m("upload")}
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <a
                href={`/login?returnTo=${encodeURIComponent(`/courses/${code}`)}`}
              >
                {m("signIn")}
              </a>
            </Button>
          ))}
      </div>
      <article className="official-materials">
        <h3>{m("officialTitle")}</h3>
        <p>{m("officialNote")}</p>
        <a
          href={officialExamSearchUrl(code)}
          target="_blank"
          rel="noreferrer"
          className="text-link"
        >
          {m("officialAction").replace("{code}", code)}
          <ArrowUpRight size={16} />
        </a>
        <p>
          <a
            href={OFFICIAL_EXAM_BROWSE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            {m("officialBrowse")}
            <ArrowUpRight size={16} />
          </a>
        </p>
        <p className="materials-note">{m("permissionPending")}</p>
      </article>
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
          {!data.uploadsEnabled && (
            <p className="materials-notice" role="status">
              {m("uploadsPaused")}
            </p>
          )}
          <p className="materials-note">{m("unscanned")}</p>
          {showUpload && session?.user && (
            <MaterialUpload
              key={updating?.id ?? "new"}
              code={code}
              updating={updating}
              maxBytes={Math.min(data.maxFileBytes, 50_000_000)}
              enabled={data.uploadsEnabled}
              onCancel={() => setShowUpload(false)}
              onComplete={() => {
                setReload((v) => v + 1);
                refreshSession();
              }}
            />
          )}
          <div className="materials-filters">
            <label>
              {m("category")}
              <select
                value={filters.category}
                onChange={(e) => filter("category", e.target.value)}
              >
                <option value="">{m("all")}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {m(category)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {m("academicYear")}
              <select
                value={filters.academicYear}
                onChange={(e) => filter("academicYear", e.target.value)}
              >
                <option value="">{m("all")}</option>
                {years.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </label>
            <label>
              {m("semester")}
              <select
                value={filters.semester}
                onChange={(e) => filter("semester", e.target.value)}
              >
                <option value="">{m("all")}</option>
                <option value="A">{m("semesterA")}</option>
                <option value="B">{m("semesterB")}</option>
                <option value="Summer">{m("summer")}</option>
              </select>
            </label>
            <label>
              {m("weekFilter")}
              <select
                value={filters.week}
                onChange={(e) => filter("week", e.target.value)}
              >
                <option value="">{m("all")}</option>
                {weeks.map((week) => (
                  <option key={week}>{week}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="materials-note">{m("unlockHint")}</p>
          {(page > 1 || data.hasMore) && (
            <nav className="pagination-row" aria-label={m("materials")}>
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
          {!visible.length ? (
            <p className="content-card">{m("empty")}</p>
          ) : (
            <div className="material-list">
              {visible.map((item) => (
                <MaterialCard
                  key={item.id}
                  code={code}
                  item={item}
                  onUpdate={
                    data.uploadsEnabled
                      ? () => {
                          setUpdating(item);
                          setShowUpload(true);
                          document
                            .getElementById("course-materials")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }
                      : undefined
                  }
                  onChanged={() => {
                    setReload((v) => v + 1);
                    refreshSession();
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MaterialCard({
  code,
  item,
  onUpdate,
  onChanged,
}: {
  code: string;
  item: Material;
  onUpdate?: () => void;
  onChanged: () => void;
}) {
  const { locale, session, sessionReady } = useRadar();
  const m = (key: MaterialMessageKey) => materialMessage(key, locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MaterialMessageKey | null>(null);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  async function download() {
    setBusy(true);
    setError(null);
    try {
      if (!item.mine && !item.unlocked) {
        await api(`/api/materials/${item.id}/unlock`, {});
        onChanged();
      }
      const path = `/api/materials/${item.id}/download`;
      const response = await fetch(path, { method: "HEAD", cache: "no-store" });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "LOGIN_REQUIRED"
            : response.status === 403
              ? "FORBIDDEN"
              : response.status === 404
                ? "NOT_FOUND"
                : "UNAVAILABLE",
        );
      // The API streams an attachment; client-side page routing would parse it as HTML.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(path);
    } catch (e) {
      setError(materialError(e));
    } finally {
      setBusy(false);
    }
  }
  async function report(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/materials/${item.id}/reports`, { reason });
      setSent(true);
    } catch (e) {
      setError(materialError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="material-card">
      <div className="material-meta">
        <span>{m(item.category)}</span>
        <span>
          {item.academicYear} · {item.semester}
        </span>
        {item.week !== null && (
          <span>
            {m("weekFilter")} {item.week}
          </span>
        )}
        <span className={`material-status status-${item.status}`}>
          {m(materialStatus(item.status))}
        </span>
      </div>
      <h3>{item.title}</h3>
      <div className="material-meta">
        {item.currentVersion && (
          <span>PDF · {formatBytes(item.currentVersion.size, locale)}</span>
        )}
        <time dateTime={item.createdAt}>
          {new Date(item.createdAt).toLocaleDateString(locale)}
        </time>
        <span>{m(rightsKeys[item.rightsBasis])}</span>
      </div>
      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-link"
        >
          {m("source")}
          <ArrowUpRight size={14} />
        </a>
      )}
      {error && (
        <p role="alert" className="form-error">
          {m(error)}
        </p>
      )}
      {item.mine &&
        item.versions?.some((version) => version.status !== "approved") && (
          <ul className="material-version-status">
            {item.versions
              .filter((version) => version.status !== "approved")
              .map((version) => (
                <li key={version.id}>
                  {m("version")} ·{" "}
                  {new Date(version.createdAt).toLocaleDateString(locale)} ·{" "}
                  {m(materialStatus(version.status))} ·{" "}
                  {formatBytes(version.size, locale)}
                </li>
              ))}
          </ul>
        )}
      <div className="material-actions">
        {item.status === "approved" &&
          (session?.user ? (
            <Button disabled={busy} onClick={download}>
              <Download size={16} />
              {m(
                item.mine
                  ? "ownDownload"
                  : item.unlocked
                    ? "unlocked"
                    : "unlock",
              )}
            </Button>
          ) : (
            <Button asChild variant="outline" disabled={!sessionReady}>
              <a
                href={`/login?returnTo=${encodeURIComponent(`/courses/${code}`)}`}
              >
                {m("signIn")}
              </a>
            </Button>
          ))}
        {item.mine && item.status === "approved" && onUpdate && (
          <Button variant="outline" disabled={busy} onClick={onUpdate}>
            {m("update")}
          </Button>
        )}
      </div>
      <details className="material-report">
        <summary>{m("report")}</summary>
        <p className="materials-note">
          {m("reportHelp")}{" "}
          <a className="text-link" href="/about">
            CityU Course Radar
          </a>
        </p>
        {sent ? (
          <p className="form-success" role="status">
            {m("reportSent")}
          </p>
        ) : (
          <form onSubmit={report}>
            <label
              htmlFor={`material-report-${item.id}`}
              className="field-label"
            >
              {m("reason")}
            </label>
            <Textarea
              id={`material-report-${item.id}`}
              required
              minLength={10}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              disabled={busy || !sessionReady}
              type="submit"
              variant="outline"
            >
              {m("report")}
            </Button>
          </form>
        )}
      </details>
    </article>
  );
}

function MaterialUpload({
  code,
  updating,
  maxBytes,
  enabled,
  onCancel,
  onComplete,
}: {
  code: string;
  updating: Material | null;
  maxBytes: number;
  enabled: boolean;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const { locale } = useRadar();
  const m = (key: MaterialMessageKey) => materialMessage(key, locale);
  const year = new Date().getFullYear();
  const [form, setForm] = useState({
    title: updating?.title ?? "",
    category: updating?.category ?? "lecture",
    academicYear: updating?.academicYear ?? `${year}/${year + 1}`,
    semester: updating?.semester ?? "A",
    week: updating?.week?.toString() ?? "",
    sourceUrl: updating?.sourceUrl ?? "",
    rightsBasis: updating?.rightsBasis ?? "own",
    rightsDeclaration: updating?.rightsDeclaration ?? "",
    rightsConfirmed: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"preparing" | "uploading" | null>(null);
  const [error, setError] = useState<MaterialMessageKey | null>(null);
  const [complete, setComplete] = useState(false);
  const [approved, setApproved] = useState(false);
  const [reservation, setReservation] = useState<{
    uploadUrl: string;
    file: File;
  } | null>(null);
  const busy = phase !== null;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setComplete(false);
    if (!file || !form.rightsConfirmed) {
      setError("INVALID_INPUT");
      return;
    }
    if (file.size > maxBytes) {
      setError("FILE_TOO_LARGE");
      return;
    }
    if (
      file.size === 0 ||
      !file.name.toLowerCase().endsWith(".pdf") ||
      (file.type && file.type !== "application/pdf")
    ) {
      setError("INVALID_FILE");
      return;
    }
    try {
      let upload = reservation;
      if (upload) {
        setPhase("preparing");
        const state = await api<{ status: string; verified: boolean }>(
          upload.uploadUrl,
        );
        if (
          ["quarantined", "approved"].includes(state.status) &&
          state.verified
        ) {
          setApproved(state.status === "approved");
          setComplete(true);
          onComplete();
          return;
        }
        if (state.status === "uploading") throw new Error("uploadInProgress");
        if (state.status !== "reserved") {
          onComplete();
          throw new Error("uploadRecovery");
        }
      }
      if (!upload || upload.file !== file) {
        setPhase("preparing");
        const digest = await crypto.subtle.digest(
          "SHA-256",
          await file.arrayBuffer(),
        );
        const sha256 = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
        const result = await api<{ uploadUrl: string }>(
          "/api/materials/uploads",
          {
            courseCode: code,
            title: form.title,
            category: form.category,
            academicYear: form.academicYear,
            semester: form.semester,
            sourceUrl: form.sourceUrl,
            rightsBasis: form.rightsBasis,
            rightsDeclaration: form.rightsDeclaration,
            week: form.week ? Number(form.week) : null,
            size: file.size,
            sha256,
            ...(updating ? { materialId: updating.id } : {}),
          },
        );
        if (!result.uploadUrl.startsWith("/api/materials/uploads/"))
          throw new Error("UNAVAILABLE");
        upload = { uploadUrl: result.uploadUrl, file };
        setReservation(upload);
      }
      setPhase("uploading");
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!response.ok) throw await responseError(response);
      const result = (await response.json()) as { ok: boolean; status: string };
      if (!result.ok || result.status !== "quarantined")
        throw new Error("UNAVAILABLE");
      setComplete(true);
      onComplete();
    } catch (e) {
      setError(materialError(e));
    } finally {
      setPhase(null);
    }
  }
  return (
    <form className="content-card material-upload" onSubmit={submit}>
      <h3>{m(updating ? "update" : "upload")}</h3>
      <p>{m(updating ? "updateNote" : "uploadRules")}</p>
      {updating && <p>{m("updateMetadata")}</p>}
      {complete ? (
        <p className="form-success" role="status">
          {m(approved ? "uploadApproved" : "uploadReceived")}
        </p>
      ) : (
        <>
          <fieldset disabled={busy || !!reservation}>
            <label htmlFor="material-title" className="field-label">
              {m("title")}
            </label>
            <Input
              id="material-title"
              required
              minLength={3}
              maxLength={160}
              value={form.title}
              disabled={!!updating}
              onChange={(e) =>
                setForm((v) => ({ ...v, title: e.target.value }))
              }
            />
            <div className="materials-fields">
              <label>
                {m("category")}
                <select
                  disabled={!!updating}
                  value={form.category}
                  onChange={(e) =>
                    setForm((v) => ({
                      ...v,
                      category: e.target.value as typeof v.category,
                    }))
                  }
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {m(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {m("academicYear")}
                <Input
                  required
                  disabled={!!updating}
                  pattern="[0-9]{4}/[0-9]{4}"
                  placeholder="2026/2027"
                  value={form.academicYear}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, academicYear: e.target.value }))
                  }
                />
              </label>
              <label>
                {m("semester")}
                <select
                  disabled={!!updating}
                  value={form.semester}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, semester: e.target.value }))
                  }
                >
                  <option value="A">{m("semesterA")}</option>
                  <option value="B">{m("semesterB")}</option>
                  <option value="Summer">{m("summer")}</option>
                </select>
              </label>
              <label>
                {m("week")}
                <Input
                  type="number"
                  min={1}
                  max={53}
                  disabled={!!updating}
                  value={form.week}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, week: e.target.value }))
                  }
                />
              </label>
            </div>
            <label htmlFor="material-rights" className="field-label">
              {m("source")}
            </label>
            <select
              id="material-rights"
              disabled={!!updating}
              value={form.rightsBasis}
              onChange={(e) =>
                setForm((v) => ({
                  ...v,
                  rightsBasis: e.target.value as typeof v.rightsBasis,
                }))
              }
            >
              {Object.entries(rightsKeys).map(([value, label]) => (
                <option key={value} value={value}>
                  {m(label)}
                </option>
              ))}
            </select>
            <label htmlFor="material-source" className="field-label">
              {m("sourceUrl")}
            </label>
            <Input
              id="material-source"
              type="url"
              maxLength={1000}
              pattern="https://.*"
              required={form.rightsBasis !== "own"}
              value={form.sourceUrl}
              disabled={!!updating}
              onChange={(e) =>
                setForm((v) => ({ ...v, sourceUrl: e.target.value }))
              }
            />
            <label htmlFor="material-declaration" className="field-label">
              {m("rights")}
            </label>
            <p id="material-rights-help" className="materials-note">
              {m("rightsHelp")}
            </p>
            <Textarea
              id="material-declaration"
              disabled={!!updating}
              aria-describedby="material-rights-help"
              required
              minLength={20}
              maxLength={2000}
              value={form.rightsDeclaration}
              onChange={(e) =>
                setForm((v) => ({ ...v, rightsDeclaration: e.target.value }))
              }
            />
            <label className="material-consent">
              <input
                type="checkbox"
                required
                checked={form.rightsConfirmed}
                onChange={(e) =>
                  setForm((v) => ({ ...v, rightsConfirmed: e.target.checked }))
                }
              />
              <span>{m("rightsConfirm")}</span>
            </label>
            <label htmlFor="material-file" className="field-label">
              {m("file")} · ≤ 50 MB
            </label>
            <Input
              id="material-file"
              type="file"
              accept=".pdf,application/pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </fieldset>
          <p className="materials-notice">{m("unscanned")}</p>
          {error && (
            <p role="alert" className="form-error">
              {m(error)}
            </p>
          )}
          {phase && (
            <p role="status" aria-live="polite">
              {m(phase)}
            </p>
          )}
          <div className="material-actions">
            <Button type="submit" disabled={busy || !enabled}>
              {m(busy ? "uploading" : reservation ? "retry" : "upload")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onCancel}
            >
              {m("cancel")}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
