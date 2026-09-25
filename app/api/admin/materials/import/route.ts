import { requireAdmin, json, failure, readJson } from "@/lib/http";
import { z } from "zod";
import index from "@/data/official-exam-index.json";
export async function GET() {
  try {
    await requireAdmin();
    return json({ ...index, canImport: false, importedFiles: 0 });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(r: Request) {
  try {
    await requireAdmin();
    z.object({ mode: z.literal("dry_run") })
      .strict()
      .parse(await readJson(r));
    return json({
      mode: "dry_run",
      canImport: false,
      importedFiles: 0,
      permission: index.redistributionPermission,
      reason: "WRITTEN_STORAGE_AND_DISTRIBUTION_PERMISSION_REQUIRED",
      publicIndex: index.papers,
    });
  } catch (e) {
    return failure(e);
  }
}
