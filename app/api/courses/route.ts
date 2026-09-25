import { getUser } from "@/lib/auth";
import { getCourse } from "@/lib/catalogue";
import { db } from "@/lib/db";
import { courseSchema } from "@/lib/validation";
import { readJson, json, failure, limit, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const input = await readJson(request),
      user = await getUser();
    if (!user) throw new HttpError(401, "LOGIN_REQUIRED");
    const c = courseSchema.parse(input);
    await limit(request, user.userId, "course", 5);
    if (await getCourse(c.code)) throw new HttpError(409, "COURSE_EXISTS");
    const result = await db()
      .prepare(
        "INSERT INTO community_courses (code,title_en,title_zh_hans,title_zh_hant,description_en,description_zh_hans,description_zh_hant,department,credits,level,source_url,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO NOTHING",
      )
      .bind(
        c.code,
        c.titleEn,
        c.titleZhHans,
        c.titleZhHant,
        c.descriptionEn,
        c.descriptionZhHans,
        c.descriptionZhHant,
        c.department,
        c.credits,
        c.level,
        c.sourceUrl,
        user.userId,
        new Date().toISOString(),
      )
      .run();
    if (!result.meta.changes) throw new HttpError(409, "COURSE_EXISTS");
    return json({ code: c.code }, 201);
  } catch (e) {
    return failure(e);
  }
}
