export const OFFICIAL_EXAM_URL =
  "https://www.cityu.edu.hk/lib/digital/exampaper/index.htm";
export const OFFICIAL_EXAM_BROWSE_URL =
  "https://www.cityu.edu.hk/lib/digital/exampaper/ftlist.htm";

// Match codeSchema without pulling validation dependencies into client bundles.
const courseCodePattern = /^[A-Z]{2,6}[0-9]{3,4}[A-Z0-9]{0,3}$/;

export function officialExamSearchUrl(code: string): string {
  const normalizedCode = code.trim().toUpperCase();
  if (!courseCodePattern.test(normalizedCode)) return OFFICIAL_EXAM_BROWSE_URL;

  // Preserve the Library's published exam query and Primo institution/view.
  // A course search does not establish that a paper is available.
  const url = new URL(
    "https://julac-cuh.primo.exlibrisgroup.com/discovery/search",
  );
  url.searchParams.append("query", "any,exact,CityU Examination Papers,AND");
  url.searchParams.append("query", `any,exact,${normalizedCode},AND`);
  url.searchParams.set("tab", "Everything");
  url.searchParams.set("search_scope", "MyInstitution");
  url.searchParams.set("sortby", "title");
  url.searchParams.set("vid", "852JULAC_CUH:CUH");
  url.searchParams.set("lang", "en");
  url.searchParams.set("mode", "advanced");
  url.searchParams.set("offset", "0");
  return url.toString();
}
