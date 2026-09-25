"use client";
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Radar, Plus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { message, type MessageKey } from "@/lib/messages";
import type { Locale } from "@/lib/types";
import { materialMessage } from "@/lib/material-messages";
export type Session = {
  canReview: boolean;
  googleEnabled: boolean;
  user: {
    id: string;
    displayName: string;
    isAdmin: boolean;
    accountId: string;
    balance: number;
  } | null;
};
const Context = createContext<{
  locale: Locale;
  t: (key: MessageKey) => string;
  session: Session | null;
  sessionReady: boolean;
  refreshSession: () => void;
}>({
  locale: "zh-Hans",
  t: (k) => message(k, "zh-Hans"),
  session: null,
  sessionReady: false,
  refreshSession: () => {},
});
export const useRadar = () => useContext(Context);
export function RadarProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh-Hans"),
    [session, setSession] = useState<Session | null>(null),
    [sessionReady, setReady] = useState(false),
    [sessionError, setSessionError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const t = (k: MessageKey) => message(k, locale);
  useEffect(() => {
    try {
      const v = localStorage.getItem("radar-locale");
      // Browser-only persisted preference is deliberately restored after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v === "en" || v === "zh-Hans" || v === "zh-Hant") setLocale(v);
    } catch {
      /* Language selection remains usable if storage is unavailable. */
    }
  }, []);
  useEffect(() => {
    let active = true;
    // Reset the prior request error when the retry subscription starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionError(false);
    fetch("/api/session")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<Session>;
      })
      .then((s) => {
        if (active) {
          setSession(s);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setReady(false);
          setSessionError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem("radar-locale", locale);
    } catch {}
    document.title = `${message("brand", locale)} · CityU Course Radar`;
  }, [locale]);
  return (
    <Context.Provider
      value={{
        locale,
        t,
        session,
        sessionReady,
        refreshSession: () => setAttempt((n) => n + 1),
      }}
    >
      <header className="site-header">
        <Link className="brand" href="/" prefetch={false}>
          <span className="brand-icon">
            <Radar size={25} />
          </span>
          <span>
            {t("brand")}
            <small>CITYU COURSE RADAR</small>
          </span>
        </Link>
        <div className="header-right">
          <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
            <SelectTrigger
              className="language-select"
              aria-label="Language / 语言"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              className="radar-select-menu"
              position="popper"
              align="start"
              collisionPadding={16}
            >
              <SelectItem value="zh-Hans">简体中文</SelectItem>
              <SelectItem value="zh-Hant">繁體中文</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
          {session?.user ? (
            <>
              <Button variant="ghost" asChild>
                <a href="/points" className="points-nav">
                  {materialMessage("points", locale)}
                  {Number.isFinite(session.user.balance) && (
                    <span>{session.user.balance}</span>
                  )}
                </a>
              </Button>
              <Button className="header-add" variant="outline" asChild>
                <a href="/add">
                  <Plus />
                  {t("add")}
                </a>
              </Button>
              <form method="post" action="/api/auth/logout">
                <Button
                  type="submit"
                  variant="ghost"
                  aria-label={t("logout")}
                  title={t("logout")}
                >
                  <LogOut size={18} />
                </Button>
              </form>
            </>
          ) : (
            <Button variant="outline" asChild>
              <a href="/login" target="_top">
                {t("login")}
              </a>
            </Button>
          )}
          <Button variant="outline" asChild>
            <a
              className="github-link"
              href="https://github.com/yqia03/cityu-course-radar-public"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("githubStarHint")}
              title={t("githubStarHint")}
            >
              {/* The local GitHub mark is distributed with its Octicons license. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/github-mark.svg" width="18" height="18" alt="" />
              <span>{t("githubStar")}</span>
            </a>
          </Button>
        </div>
      </header>
      {(sessionError || session?.canReview === false) && (
        <div className="session-error" role="alert">
          <span>
            {t(session?.canReview === false ? "RATE_LIMIT" : "UNAVAILABLE")}
          </span>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            {t("retry")}
          </Button>
        </div>
      )}
      {children}
      <footer className="site-footer">
        <div>
          <strong>{t("brand")}</strong>
          <p>{t("footer")}</p>
        </div>
        <nav>
          <a href="/about">{t("about")}</a>
          <a href="/privacy">{t("privacy")}</a>
          <a href="/terms">{t("terms")}</a>
          {session?.user?.isAdmin && <a href="/admin">{t("admin")}</a>}
        </nav>
      </footer>
    </Context.Provider>
  );
}
