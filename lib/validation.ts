import { z } from "zod";
export const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,6}[0-9]{3,4}[A-Z0-9]{0,3}$/);
export const reviewSchema = z
  .object({
    usefulness: z.number().int().min(1).max(5),
    interest: z.number().int().min(1).max(5),
    difficulty: z.number().int().min(1).max(5),
    // Experience text is optional; readJson bounds the entire request body.
    comment: z.string().trim().default(""),
    nickname: z.string().trim().max(30).default(""),
    semester: z.string().trim().max(40).default(""),
    website: z.string().max(0).optional(),
  })
  .strict();
const title = z.string().trim().min(2).max(200),
  desc = z.string().trim().min(10).max(2000);
export const courseSchema = z
  .object({
    code: codeSchema,
    titleEn: title,
    titleZhHans: title,
    titleZhHant: title,
    descriptionEn: desc,
    descriptionZhHans: desc,
    descriptionZhHant: desc,
    department: title,
    credits: z.string().trim().max(30),
    level: z.enum(["ug", "pg"]),
    sourceUrl: z
      .string()
      .url()
      .max(500)
      .refine((v) => {
        try {
          const u = new URL(v);
          return (
            u.protocol === "https:" &&
            (u.hostname === "cityu.edu.hk" ||
              u.hostname.endsWith(".cityu.edu.hk"))
          );
        } catch {
          return false;
        }
      }),
  })
  .strict();
export const reportSchema = z
  .object({
    reviewId: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
