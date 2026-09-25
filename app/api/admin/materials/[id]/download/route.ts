import { download } from "@/lib/material-download";
import { failure } from "@/lib/http";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await download(r, (await params).id, true);
  } catch (e) {
    return failure(e);
  }
}
export const HEAD = GET;
