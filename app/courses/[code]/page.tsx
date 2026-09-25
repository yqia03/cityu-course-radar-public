import { CourseDetail } from "@/components/course-detail";
export default async function CoursePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <CourseDetail code={code.toUpperCase()} />;
}
