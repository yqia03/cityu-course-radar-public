import { allCourses, stats, filterCourses } from "@/lib/catalogue";
import { json, failure } from "@/lib/http";
export async function GET(request: Request) {
  try {
    const [courses, scores] = await Promise.all([allCourses(), stats()]);
    return json(
      filterCourses(courses, scores, new URL(request.url).searchParams),
    );
  } catch (e) {
    return failure(e);
  }
}
