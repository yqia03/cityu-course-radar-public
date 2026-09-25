import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const publicDocs = new Set([
  "architecture.md",
  "catalogue.md",
  "cloudflare-deployment.md",
  "database-migrations.md",
  "external-reviews.md",
  "external-reviews-expansion-2026-09-25.md",
  "external-reviews-search-2026-09-25.json",
  "materials-operations.md",
  "operations.md",
  "points-accounting.md",
  "public-repository.md",
  "security.md",
]);
const rootFiles = new Set([
  ".env.example",
  ".gitignore",
  ".npmrc",
  ".prettierignore",
  "cloudflare-env.d.ts",
  "proxy.ts",
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "THIRD_PARTY_NOTICES.md",
  "package.json",
  "package-lock.json",
  "components.json",
  "eslint.config.mjs",
  "next.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "vite.config.ts",
  "drizzle.config.ts",
  "wrangler.json",
  "wrangler.local.json",
]);
export function isPublicPath(path) {
  if (path.split("/").some((part) => part === ".." || part === ".git"))
    return false;
  if (path.startsWith("docs/")) return publicDocs.has(path.slice(5));
  return (
    rootFiles.has(path) ||
    /^(app|components|hooks|lib|db|drizzle|tests|scripts|data|public|vendor|build|\.github)\//.test(
      path,
    )
  );
}
export function sanitizePublicFile(path, original) {
  let text = original;
  if (path === "wrangler.json") {
    const config = JSON.parse(text);
    delete config.account_id;
    config.vars.APP_ORIGIN = "https://your-domain.example";
    config.vars.CONTACT_EMAIL = "";
    for (const db of config.d1_databases ?? [])
      db.database_id = "00000000-0000-4000-8000-000000000000";
    text = JSON.stringify(config, null, 2) + "\n";
  }
  if (/^(data|docs)\//.test(path)) {
    text = text.replace(/https?:\/\/[^\s<>"'`\\)]+/g, (value) => {
      try {
        const url = new URL(value);
        let changed = false;
        for (const name of [...url.searchParams.keys()]) {
          if (
            /^(xsec_.*|utm_.*|access_token|auth_token|signature|x-amz-.*)$/i.test(
              name,
            )
          ) {
            url.searchParams.delete(name);
            changed = true;
          }
        }
        return changed ? url.href : value;
      } catch {
        return value;
      }
    });
  }
  if (path === "README.md") {
    text = text.replace(
      "## 本地启动",
      "## 公开源码\n\n公开仓库：[cityu-course-radar-public](https://github.com/yqia03/cityu-course-radar-public)。喜欢本站，欢迎点个 Star。此仓库为经过筛选的源码快照，不包含生产账户配置、用户数据、密钥或私有提交历史。部署前请按 [公开仓库说明](docs/public-repository.md) 配置自己的 Cloudflare 资源。\n\n## 本地启动",
    );
  }
  if (path === "docs/cloudflare-deployment.md") {
    text = text
      .replaceAll("https://cityuhk.uwaylab.com", "https://your-domain.example")
      .replaceAll("`uwaylab.com`", "`your-domain.example`");
  }
  if (path === "docs/security.md")
    text = text.split("\n## Historical verification record")[0];
  if (path === "docs/materials-operations.md") {
    text = text
      .split("\n\n")
      .map((paragraph) => {
        if (paragraph.startsWith("实施日期："))
          return "此手册描述实现接口，不代表你的部署已验收。上传默认受限，必须核对自己的套餐、账户总用量、权限和真实生产行为后再开放。没有自动病毒扫描器，格式与摘要检查不能称为病毒扫描。";
        if (paragraph.startsWith("50 MB 在本地"))
          return "本地流式测试不能证明生产 Workers CPU 余量。必须在自己的实际套餐下测量一次完整上传的可归因 CPU，并核对 Workers/D1/R2 共享额度。证据不足时保持停传；不要自动升级套餐或增加付费服务。";
        if (
          paragraph.startsWith("该次审查 SQL") ||
          paragraph.startsWith("本次清理后的")
        )
          return "";
        return paragraph
          .replace(
            "2026-09-25 的已批准测试材料使用专门流程清理",
            "已批准的自建测试材料应使用专门流程清理",
          )
          .replace("生产当前为 `admin-only`", "模板默认值为 `admin-only`")
          .replace(
            "站长联系邮箱沿用 `yqia03@outlook.com`",
            "站长联系邮箱通过 `CONTACT_EMAIL` 配置",
          );
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return text;
}

async function main() {
  const { format } = await import("prettier");
  const destination = process.argv[2];
  if (!destination)
    throw new Error(
      "Usage: node scripts/export-public.mjs <new-empty-directory>",
    );
  const output = resolve(destination);
  // Refuse to reuse a directory, including an existing checkout or prior export.
  await mkdir(output);
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const entries = execFileSync("git", ["ls-tree", "-rz", revision], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  let copied = 0;
  for (const entry of entries) {
    const [metadata, path] = entry.split("\t");
    if (!isPublicPath(path)) continue;
    const [mode, type, hash] = metadata.split(" ");
    if (type !== "blob" || !["100644", "100755"].includes(mode))
      throw new Error(`Unsupported public entry: ${path}`);
    const bytes = execFileSync("git", ["cat-file", "blob", hash], {
      maxBuffer: 32 * 1024 * 1024,
    });
    if (bytes.includes(0))
      throw new Error(
        `Binary file needs explicit review before public export: ${path}`,
      );
    const target = resolve(output, path);
    await mkdir(dirname(target), { recursive: true });
    let contents = sanitizePublicFile(path, bytes.toString("utf8"));
    if (path.endsWith(".md"))
      contents = await format(contents, { parser: "markdown" });
    await writeFile(target, contents, {
      flag: "wx",
      mode: mode === "100755" ? 0o755 : 0o644,
    });
    copied++;
  }
  console.log(
    `Exported ${copied} committed files from ${revision}. Review, test and secret-scan this directory before publishing. No Git history or ignored/untracked files were copied.`,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
