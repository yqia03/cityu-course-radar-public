export function canonicalUrl(source: URL, origin: string) {
  const target = new URL(origin);
  target.pathname = source.pathname;
  target.search = source.search;
  return target;
}
