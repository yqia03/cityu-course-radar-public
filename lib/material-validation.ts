import { z } from "zod";
export const MAX_FILE_BYTES = 50_000_000;
export const MAX_CAPACITY_BYTES = 8_000_000_000;
export const uploadSchema = z
  .object({
    courseCode: z
      .string()
      .min(2)
      .max(20)
      .regex(/^[A-Za-z0-9]+$/)
      .transform((s) => s.toUpperCase()),
    title: z.string().trim().min(3).max(160),
    category: z.enum(["lecture", "tutorial", "past_exam", "notes"]),
    academicYear: z
      .string()
      .regex(/^20\d{2}\/20\d{2}$/)
      .refine((s) => Number(s.slice(5)) === Number(s.slice(0, 4)) + 1),
    semester: z.enum(["A", "B", "Summer"]),
    week: z.number().int().min(1).max(53).nullable().default(null),
    sourceUrl: z
      .union([
        z.literal(""),
        z
          .string()
          .url()
          .max(1000)
          .refine((s) => {
            const u = new URL(s);
            return u.protocol === "https:" && !u.username && !u.password;
          }),
      ])
      .default(""),
    rightsBasis: z.enum(["own", "permission", "open_license"]),
    rightsDeclaration: z.string().trim().min(20).max(2000),
    size: z.number().int().min(20).max(MAX_FILE_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    materialId: z.string().uuid().optional(),
  })
  .strict()
  .refine((d) => d.rightsBasis === "own" || d.sourceUrl.length > 0, {
    path: ["sourceUrl"],
  });
// Conservative admission, not a parser or malware scanner. Obfuscated active
// content can still exist; quarantine and a human rights/content review remain mandatory.
export class PdfAdmission {
  size = 0;
  private prefix = "";
  private tail = "";
  inspect(chunk: Uint8Array, expected: number) {
    this.size += chunk.length;
    if (this.size > expected || this.size > MAX_FILE_BYTES)
      throw new Error("FILE_SIZE");
    const text = new TextDecoder("latin1").decode(chunk);
    if (this.prefix.length < 16)
      this.prefix = (this.prefix + text).slice(0, 16);
    const sample = this.tail + text;
    if (
      /\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction|AA|Encrypt)\b/.test(
        sample,
      )
    )
      throw new Error("ACTIVE_PDF");
    this.tail = sample.slice(-2048);
  }
  finish(expected: number) {
    if (this.size !== expected) throw new Error("FILE_SIZE");
    if (
      !/^%PDF-1\.[0-9][\r\n ]|^%PDF-2\.0[\r\n ]/.test(this.prefix) ||
      !this.tail.trimEnd().endsWith("%%EOF")
    )
      throw new Error("INVALID_PDF");
  }
}
export function checksumHex(value: ArrayBuffer | undefined) {
  return value
    ? Array.from(new Uint8Array(value), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("")
    : null;
}
