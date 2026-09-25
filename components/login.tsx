"use client";
import { useEffect, useState } from "react";
import { useRadar } from "./radar-provider";
import { Button } from "./ui/button";
export function Login() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Read the callback status only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(new URLSearchParams(window.location.search).has("error"));
  }, []);
  const { t, session, sessionReady } = useRadar();
  return (
    <main className="shell about-shell">
      <h1>{t("login")}</h1>
      <section className="content-card">
        <p>{t("loginPurpose")}</p>
        {session?.user ? (
          <>
            <p>{session.user.displayName}</p>
            <p>
              {t("userId")}: <code>{session.user.id}</code>
            </p>
            <a href="/add">{t("add")}</a>
          </>
        ) : (
          <>
            <form action="/api/auth/google" method="post">
              <Button
                type="submit"
                disabled={
                  !sessionReady ||
                  !session?.canReview ||
                  !session?.googleEnabled
                }
              >
                {t("googleLogin")}
              </Button>
            </form>
            {sessionReady && !session?.googleEnabled && (
              <p role="status">{t("loginPending")}</p>
            )}
            {failed && <p role="alert">{t("loginFailed")}</p>}
          </>
        )}
        <p>
          <a href="/privacy">{t("privacy")}</a> ·{" "}
          <a href="/terms">{t("terms")}</a>
        </p>
      </section>
    </main>
  );
}
