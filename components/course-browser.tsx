"use client";
import { useEffect, useState, useRef } from "react";
import { flushSync } from "react-dom";
import {
  Radar,
  Search,
  Plus,
  ShieldCheck,
  MessageSquare,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { useRadar } from "./radar-provider";
import { errorKey } from "@/lib/client";
import { chineseTitle, description, type CourseResult } from "@/lib/types";
import type { MessageKey } from "@/lib/messages";
import departments from "@/data/departments.json";
type Catalogue = {
  courses: CourseResult[];
  total: number;
  page: number;
  pages: number;
  catalogueTotal: number;
  reviewTotal: number;
  departments: string[];
  externalCoverage: {
    courses: number;
    references: number;
    sources: number;
    platforms: string[];
  };
};
export function Department({ name }: { name: string }) {
  const { locale } = useRadar();
  const d = (
    departments as Record<string, { titleZhHans: string; titleZhHant: string }>
  )[name];
  return (
    <>
      {d && locale !== "en"
        ? locale === "zh-Hans"
          ? d.titleZhHans
          : d.titleZhHant
        : name}
    </>
  );
}
export function CourseBrowser() {
  const { t, locale } = useRadar();
  const skipFetch = useRef(false);
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("all"),
    [department, setDepartment] = useState("all"),
    [level, setLevel] = useState("all"),
    [page, setPage] = useState(1),
    [data, setData] = useState<Catalogue | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<MessageKey | null>(null),
    [retry, setRetry] = useState(0),
    [ready, setReady] = useState(false);
  const searchState = useRef({ query, sort, department, level, page });
  useEffect(() => {
    searchState.current = { query, sort, department, level, page };
  }, [query, sort, department, level, page]);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    // Hydrate URL-backed filters after SSR; the first render must match the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(p.get("q") || "");
    setSort(
      ["all", "worst", "best", "popular"].includes(p.get("sort") || "")
        ? p.get("sort")!
        : "all",
    );
    setDepartment(p.get("department") || "all");
    setLevel(p.get("level") || "all");
    setPage(Math.max(1, Number(p.get("page")) || 1));
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (skipFetch.current) {
      skipFetch.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      const p = new URLSearchParams({ sort, page: String(page) });
      if (query) p.set("q", query);
      if (department !== "all") p.set("department", department);
      if (level !== "all") p.set("level", level);
      history.replaceState(null, "", `/?${p}`);
      try {
        const r = await fetch(`/api/catalogue?${p}`, {
          signal: controller.signal,
        });
        const result = (await r.json()) as Catalogue & { error?: string };
        if (!r.ok) throw new Error(result.error);
        setData(result);
        setError(null);
      } catch (e) {
        if (!controller.signal.aborted) setError(errorKey(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, sort, department, level, page, retry, ready]);
  useEffect(() => {
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!ctx?.registerTool) return;
    const life = new AbortController();
    void Promise.resolve(
      ctx.registerTool(
        {
          name: "search_courses",
          description:
            "Search CityU courses and change the visible search results. Does not post reviews.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string", maxLength: 150 } },
            required: ["query"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          async execute(input: unknown) {
            if (
              !input ||
              typeof input !== "object" ||
              !("query" in input) ||
              typeof input.query !== "string" ||
              input.query.length > 150
            )
              throw new Error("Invalid query");
            const q = input.query;
            const response = await fetch(
              `/api/catalogue?q=${encodeURIComponent(q)}`,
            );
            if (!response.ok) throw new Error("Catalogue unavailable");
            const result: Catalogue = await response.json();
            const current = searchState.current;
            skipFetch.current =
              current.query !== q ||
              current.sort !== "all" ||
              current.department !== "all" ||
              current.level !== "all" ||
              current.page !== 1;
            flushSync(() => {
              setQuery(q);
              setDepartment("all");
              setLevel("all");
              setSort("all");
              setPage(1);
              setData(result);
              setLoading(false);
              setError(null);
            });
            history.replaceState(
              null,
              "",
              `/?q=${encodeURIComponent(q)}&sort=all&page=1`,
            );
            return {
              total: result.total,
              courses: result.courses.map((c) => ({
                code: c.code,
                title: c.titleEn,
              })),
            };
          },
        },
        { signal: life.signal },
      ),
    ).catch(() => {});
    return () => life.abort();
  }, []);
  return (
    <main className="shell">
      <div className="eyebrow">{t("independent")}</div>
      <section className="intro">
        <div>
          <h1>{t("headline")}</h1>
          <p>{t("subhead")}</p>
        </div>
        <Button asChild>
          <a href="/add">
            <Plus />
            {t("add")}
          </a>
        </Button>
      </section>
      <section className="search-bar">
        <Search />
        <Input
          value={query}
          maxLength={150}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          aria-label={t("search")}
          placeholder={t("search")}
        />
        {query && (
          <button
            aria-label={t("close")}
            onClick={() => {
              setQuery("");
              setPage(1);
            }}
          >
            ×
          </button>
        )}
      </section>
      <div className="workspace">
        <section>
          <Tabs
            value={sort}
            onValueChange={(s) => {
              setSort(s);
              setPage(1);
            }}
          >
            <TabsList className="course-tabs" aria-label={t("all")}>
              <TabsTrigger value="all">{t("all")}</TabsTrigger>
              <TabsTrigger value="worst">{t("worst")}</TabsTrigger>
              <TabsTrigger value="best">{t("best")}</TabsTrigger>
              <TabsTrigger value="popular">{t("popular")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="filters">
            <Select
              value={department}
              onValueChange={(v) => {
                setDepartment(v);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label={t("allDepartments")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className="radar-select-menu"
                position="popper"
                align="start"
                collisionPadding={16}
              >
                <SelectItem value="all">{t("allDepartments")}</SelectItem>
                {data?.departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    <Department name={d} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={level}
              onValueChange={(v) => {
                setLevel(v);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label={t("level")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className="radar-select-menu"
                position="popper"
                align="start"
                collisionPadding={16}
              >
                <SelectItem value="all">{t("allLevels")}</SelectItem>
                <SelectItem value="ug">{t("ug")}</SelectItem>
                <SelectItem value="pg">{t("pg")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="list-label">
            <span>
              {sort === "best" || sort === "worst"
                ? t("rankingRule")
                : t("officialLabel")}
            </span>
            <span>
              {data
                ? `${data.total.toLocaleString()} ${t("courses")}`
                : "2026 / 27"}
            </span>
          </div>
          {error ? (
            <div className="error-state" role="alert">
              <p>{t(error)}</p>
              <Button variant="outline" onClick={() => setRetry((r) => r + 1)}>
                {t("retry")}
              </Button>
            </div>
          ) : loading ? (
            <div aria-label={t("loading")} aria-busy="true">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-52 mb-4 rounded-xl" />
              ))}
            </div>
          ) : data?.courses.length ? (
            data.courses.map((c) => (
              <article className="course-row" key={c.code}>
                <div className={`score-box ${c.stats.count ? "rated" : ""}`}>
                  {c.stats.score?.toFixed(1) || "—"}
                  <small>{c.stats.count ? "/ 5" : t("unrated")}</small>
                </div>
                <div className="course-main">
                  <div className="course-meta">
                    <strong>{c.code}</strong>
                    {c.archived && <span>{t("archived")}</span>}
                    <span>
                      <Department name={c.department} />
                    </span>
                    {(c.credits !== null || c.creditsText) && (
                      <span>
                        {c.credits ?? c.creditsText} {t("credits")}
                      </span>
                    )}
                  </div>
                  <h2>
                    <a href={`/courses/${c.code}`} lang="en">
                      {c.titleEn}
                    </a>
                  </h2>
                  {chineseTitle(c, locale) && (
                    <p
                      className="course-translation"
                      lang={locale === "zh-Hant" ? "zh-Hant" : "zh-Hans"}
                    >
                      {chineseTitle(c, locale)}
                    </p>
                  )}
                  <p className="course-summary line-clamp-2">
                    {description(c, locale) || t("noDescription")}
                  </p>
                  {!!c.externalReviews?.length && (
                    <div className="external-preview">
                      <a href={`/courses/${c.code}#external-reviews`}>
                        <BookOpen size={14} />
                        {c.externalReviews.length} {t("externalCount")}
                      </a>
                      <span>
                        {[
                          ...new Set(c.externalReviews.map((r) => r.platform)),
                        ].join(" · ")}
                      </span>
                    </div>
                  )}
                  <div className="course-bottom">
                    <span>
                      <MessageSquare size={14} />
                      {c.stats.count
                        ? `${c.stats.count} ${t("reviews")}`
                        : c.externalReviews?.length
                          ? t("noNativeReviews")
                          : t("firstReview")}
                    </span>
                    <a className="review-link" href={`/courses/${c.code}`}>
                      {t("view")}
                      <ArrowRight size={14} />
                    </a>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <Empty className="empty-state">
              <EmptyHeader>
                <Radar size={35} />
                <EmptyTitle>
                  {t(
                    sort === "best" || sort === "worst" ? "emptyRank" : "empty",
                  )}
                </EmptyTitle>
                <EmptyDescription>
                  {t(
                    sort === "best" || sort === "worst"
                      ? "emptyRankHelp"
                      : "emptyHelp",
                  )}
                </EmptyDescription>
              </EmptyHeader>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setLevel("all");
                  setDepartment("all");
                  setSort("all");
                  setPage(1);
                }}
              >
                {t("all")}
              </Button>
            </Empty>
          )}
          {data && data.pages > 1 && !loading && !error && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((p) => p - 1);
                      window.scrollTo({ top: 230, behavior: "smooth" });
                    }}
                  >
                    {t("previous")}
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="page-number">
                    {page} / {data.pages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    disabled={page >= data.pages}
                    onClick={() => {
                      setPage((p) => p + 1);
                      window.scrollTo({ top: 230, behavior: "smooth" });
                    }}
                  >
                    {t("next")}
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </section>
        <aside>
          <div className="catalogue-stats">
            <div>
              <strong>
                {data?.catalogueTotal.toLocaleString() || "4,422"}
              </strong>
              <span>{t("courses")}</span>
            </div>
            <div>
              <strong>{data?.reviewTotal.toLocaleString() ?? "—"}</strong>
              <span>{t("nativeReviews")}</span>
            </div>
          </div>
          <div className="note-card">
            <p className="external-coverage">
              <strong>{data?.externalCoverage?.courses ?? "—"}</strong>{" "}
              {t("externalCourses")}
              <br />
              {data?.externalCoverage?.references ?? "—"} {t("externalCount")}
            </p>
            <span className="note-kicker">
              <Radar size={18} />
              {t("guide")}
            </span>
            <h3>{t("guideTitle")}</h3>
            <ol className="review-guide">
              <li>{t("guideOpen")}</li>
              <li>{t("guideRate")}</li>
              <li>{t("guidePost")}</li>
            </ol>
            <hr />
            <p className="fine">
              <ShieldCheck size={17} />
              {t("anonymousHint")}
            </p>
          </div>
          <div className="aside-copy">
            <a className="text-link" href="/about">
              {t("about")}
              <ArrowUpRight size={14} />
            </a>
          </div>
          <p className="translation-note">{t("translation")}</p>
        </aside>
      </div>
    </main>
  );
}
