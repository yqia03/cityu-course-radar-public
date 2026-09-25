import test from "node:test";
import assert from "node:assert/strict";
import {
  PdfAdmission,
  uploadSchema,
  MAX_FILE_BYTES,
} from "../lib/material-validation.ts";
const pdf = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
);
test("streaming PDF admission validates real bytes across chunk boundaries", () => {
  const p = new PdfAdmission();
  for (const chunk of pdf) p.inspect(Uint8Array.of(chunk), pdf.length);
  p.finish(pdf.length);
  assert.throws(() => {
    const q = new PdfAdmission();
    q.inspect(pdf, pdf.length - 1);
  }, /FILE_SIZE/);
  assert.throws(() => {
    const q = new PdfAdmission();
    q.inspect(pdf, pdf.length + 1);
    q.finish(pdf.length + 1);
  }, /FILE_SIZE/);
  for (const source of [
    "<html>payload</html>",
    "%PDF-1.4\nno trailer",
    "%PDF-1.4\n/JavaScript(test)\n%%EOF",
    "%PDF-1.4\n/EmbeddedFile 1\n%%EOF",
  ]) {
    const bad = new TextEncoder().encode(source);
    assert.throws(() => {
      const q = new PdfAdmission();
      for (const n of bad) q.inspect(Uint8Array.of(n), bad.length);
      q.finish(bad.length);
    }, /INVALID_PDF|ACTIVE_PDF/);
  }
});
test("upload declarations have bounded size and require rights evidence", () => {
  const base = {
    courseCode: "CS1102",
    title: "My personal notes",
    category: "notes",
    academicYear: "2025/2026",
    semester: "A",
    rightsBasis: "own",
    rightsDeclaration:
      "I authored these notes and have the right to distribute them.",
    size: pdf.length,
    sha256: "a".repeat(64),
  };
  assert.equal(uploadSchema.parse(base).courseCode, "CS1102");
  for (const x of [
    { size: MAX_FILE_BYTES + 1 },
    { size: -1 },
    { sha256: "fake" },
    { academicYear: "2025/2025" },
    { rightsBasis: "permission" },
    { sourceUrl: "javascript:alert(1)" },
    { ownerId: "forged" },
  ])
    assert.equal(uploadSchema.safeParse({ ...base, ...x }).success, false);
});
