import { getUser } from "@/lib/auth";
import { getCourse } from "@/lib/catalogue";
import { json, failure, HttpError } from "@/lib/http";
import {
  listMaterials,
  usage,
  OFFICIAL_EXAM_URL,
  canUploadMaterials,
} from "@/lib/materials";
import { db } from "@/lib/db";
import { z } from "zod";
import { MAX_FILE_BYTES } from "@/lib/material-validation";
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const code = (await params).code.toUpperCase();
    if (!(await getCourse(code))) throw new HttpError(404, "NOT_FOUND");
    const u = await getUser();
    const page = Math.max(
      1,
      Math.min(
        10000,
        Number.parseInt(new URL(_r.url).searchParams.get("page") || "1") || 1,
      ),
    );
    const q = new URL(_r.url).searchParams;
    const filters = z
      .object({
        category: z
          .enum(["lecture", "tutorial", "past_exam", "notes"])
          .optional(),
        academicYear: z
          .string()
          .regex(/^20\d{2}\/20\d{2}$/)
          .optional(),
        semester: z.enum(["A", "B", "Summer"]).optional(),
        week: z.coerce.number().int().min(1).max(53).optional(),
      })
      .parse(
        Object.fromEntries(
          ["category", "academicYear", "semester", "week"]
            .filter((k) => q.has(k) && q.get(k) !== "")
            .map((k) => [k, q.get(k)]),
        ),
      );
    const options = await db()
      .prepare(
        "SELECT DISTINCT academic_year,week FROM materials WHERE course_code=? AND (status='approved' OR owner_id=?)",
      )
      .bind(code, u?.userId || "")
      .all<{ academic_year: string; week: number | null }>();
    const filterOptions = {
      academicYears: [...new Set(options.results.map((x) => x.academic_year))]
        .sort()
        .reverse(),
      weeks: [
        ...new Set(
          options.results
            .map((x) => x.week)
            .filter((v): v is number => v !== null),
        ),
      ].sort((a, b) => a - b),
    };
    const materials = await listMaterials(
      code,
      u?.userId || null,
      false,
      page,
      filters,
    );
    return json({
      materials,
      filterOptions,
      page,
      hasMore: materials.length === 50,
      uploadsEnabled:
        (await usage()).uploadsEnabled && canUploadMaterials(u?.userId || null),
      maxFileBytes: MAX_FILE_BYTES,
      officialExamUrl: OFFICIAL_EXAM_URL,
      scanStatus: "not_scanned",
    });
  } catch (e) {
    return failure(e);
  }
}
