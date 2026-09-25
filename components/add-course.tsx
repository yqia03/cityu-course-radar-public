"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, BookPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useRadar } from "./radar-provider";
import { api, errorKey } from "@/lib/client";
import type { MessageKey } from "@/lib/messages";
export function AddCourse() {
  const router = useRouter();
  const { t, session, sessionReady } = useRadar();
  const [error, setError] = useState<MessageKey | null>(null),
    [saving, setSaving] = useState(false),
    [level, setLevel] = useState("ug");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setSaving(true);
    setError(null);
    try {
      const result = await api<{ code: string }>("/api/courses", {
        ...data,
        level,
      });
      router.push(`/courses/${result.code}`);
    } catch (e) {
      setError(errorKey(e));
      setSaving(false);
    }
  }
  return (
    <main className="shell form-shell">
      <Link className="back-link" href="/" prefetch={false}>
        <ArrowLeft size={16} />
        {t("back")}
      </Link>
      <div className="form-intro">
        <BookPlus size={31} />
        <h1>{t("addTitle")}</h1>
        <p>{t("addHelp")}</p>
      </div>
      {!sessionReady ? (
        <p role="status">{t("loading")}</p>
      ) : !session?.user ? (
        <section className="content-card signin-card">
          <h2>{t("loginRequired")}</h2>
          <p>{t("loginHelp")}</p>
          <Button asChild>
            <a href="/login" target="_top">
              {t("googleLogin")}
            </a>
          </Button>
        </section>
      ) : (
        <form onSubmit={submit} className="content-card add-form">
          <div className="form-grid">
            {(
              [
                {
                  name: "code",
                  label: "courseCode",
                  placeholder: "CS9999",
                  pattern: "[A-Za-z]{2,6}[0-9]{3,4}[A-Za-z0-9]{0,3}",
                },
                { name: "credits", label: "credits", placeholder: "3" },
                { name: "titleEn", label: "titleEn" },
                { name: "department", label: "department" },
                { name: "titleZhHans", label: "titleHans" },
                { name: "titleZhHant", label: "titleHant" },
              ] as {
                name: string;
                label: MessageKey;
                placeholder?: string;
                pattern?: string;
              }[]
            ).map((f) => (
              <div key={f.name}>
                <label className="field-label" htmlFor={f.name}>
                  {t(f.label)}
                </label>
                <Input
                  id={f.name}
                  name={f.name}
                  required
                  maxLength={f.name === "credits" ? 30 : 200}
                  minLength={f.name === "credits" ? 1 : 2}
                  placeholder={f.placeholder}
                  pattern={f.pattern}
                />
              </div>
            ))}
            <div>
              <label className="field-label" id="level-label">
                {t("level")}
              </label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger aria-labelledby="level-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className="radar-select-menu"
                  position="popper"
                  align="start"
                  collisionPadding={16}
                >
                  <SelectItem value="ug">{t("ug")}</SelectItem>
                  <SelectItem value="pg">{t("pg")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="field-label" htmlFor="sourceUrl">
                {t("sourceUrl")}
              </label>
              <Input
                id="sourceUrl"
                name="sourceUrl"
                type="url"
                required
                maxLength={500}
                placeholder="https://www.cityu.edu.hk/…"
              />
            </div>
          </div>
          {(
            [
              { name: "descriptionEn", label: "descriptionEn" },
              { name: "descriptionZhHans", label: "descriptionHans" },
              { name: "descriptionZhHant", label: "descriptionHant" },
            ] as { name: string; label: MessageKey }[]
          ).map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name} className="field-label">
                {t(f.label)}
              </label>
              <Textarea
                id={f.name}
                name={f.name}
                required
                minLength={10}
                maxLength={2000}
                rows={4}
              />
            </div>
          ))}
          {error && (
            <p className="form-error" role="alert">
              {t(error)}
            </p>
          )}
          <Button type="submit" disabled={saving}>
            {t(saving ? "saving" : "addSubmit")}
          </Button>
        </form>
      )}
    </main>
  );
}
