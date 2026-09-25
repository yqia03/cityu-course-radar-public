# 课程资料与翻译维护

首次快照：2026/27，2026-09-11 获取。4,422 个不同课程代码（本科 2,312、研究生 2,110、GE 170）。研究生授课式、研究式与专业博士全索引交叉核对后代码集合相同，因此只抓一份。41 个主教学单位，另保留联合开课单位。

数据来源：

- https://www.cityu.edu.hk/catalogue/ug/current/catalogue/B/B_course_index_full.htm
- https://www.cityu.edu.hk/catalogue/pg/current/catalogue/TP/TP_course_index_full.htm

首次导入 4,396 条简介来自 HTML、25 条来自官方 PDF、1 条为根据官方学习成果/教学纲要撰写的明确标注概述。2 个失效 HTML 链接由同年官方 PDF 恢复。数据中的 `descriptionSource` / `descriptionSourceUrl` 区分这些情况；`data/import-report.json` 记录覆盖范围与原始故障。

## 1. 准备维护环境

网页运行不需要这些 Python 包。只有刷新资料或生成新译文时需要：

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/catalogue/requirements.txt
mkdir -p models data/staging data/cache
curl --fail --location https://argos-net.com/v1/translate-en_zh-1_9.argosmodel --output models/en-zh.argosmodel
python3 -c "import hashlib,pathlib; assert hashlib.sha256(pathlib.Path('models/en-zh.argosmodel').read_bytes()).hexdigest() == '433e7c4f034d87fbe2353161e05f18646d7999452f801a4e1f0378522b9850ab'"
python3 -m zipfile -e models/en-zh.argosmodel models
```

模型、虚拟环境、抓取缓存均已忽略，不要推送进仓库。模型信息与许可见 `data/translation/provenance.json`。传统中文由 OpenCC 字形转换，尚未全面做香港用词校订。

## 2. 抓取和回填

每次刷新使用新的暂存目录，避免将以前缓存当成当前资料；中断后使用同一目录即可续跑。下面以 `data/staging/refresh` 为例，开始新一轮时更换目录名。先查看学校最新 robots.txt 与来源政策，再执行：

```sh
python3 scripts/catalogue/import_cityu.py --output-dir data/staging/refresh --delay 0.35 --workers 4
cp data/overrides/*.json data/staging/refresh/
.venv/bin/python scripts/catalogue/enrich_syllabi.py --directory data/staging/refresh
python3 scripts/catalogue/finalize_catalogue.py --directory data/staging/refresh
```

抓取器有全局限速、超时、重试、原子写入和每百门课程进度保存。错误课程留在索引中并记录故障，不会静默丢失。年限定修复不会套用到其他学年；新增异常需查阅官方 PDF，并把可验证修复写入 `data/overrides/`。学分可能是 0、1.5 或可变值，不能默认成 3。

## 3. 本地翻译与校对

```sh
.venv/bin/python scripts/catalogue/translate_catalogue.py --input data/staging/refresh/courses-complete.json --output-dir data/staging/translated --model models/translate-en_zh-1_9 --cache data/cache/translation-cache.json
python3 scripts/catalogue/verify_translation_data.py --source data/staging/refresh/courses-complete.json --translated data/staging/translated/courses-translated.json --departments data/departments.json
```

按原文内容哈希缓存译文，只翻译新增/变更文本。课名精确修订位于 `data/translation/editorial-glossary.json`，简介修订位于 `description-glossary.json`；修订键是英文原文，源文变更会自然失效，避免把旧译文错误覆盖新内容。中文简介取官方第一句或最多 600 字符的原文摘录。若新增教学单位，先核对官方中文名称再更新 `data/departments.json`。

初始抽样确实发现并修正了专业术语错误；398 门课程标题命中编辑词典。全量仍标记 `needs-human-review`。`qualityFlagCount=0` 只表示空白、长度、重复、字符等结构检查通过，不代表语义准确率为 100%。保留英文来源，逐步改善词典。

## 4. 发布快照

```sh
python3 scripts/catalogue/promote_catalogue.py --input data/staging/translated/courses-translated.json --report data/staging/refresh/import-report.json
cp data/staging/refresh/import-report.json data/import-report.json
cp data/staging/translated/coverage.json data/translation/coverage.json
npm run catalogue:pack
npm test
```

推广器拒绝数量不匹配、来源失败或三语字段不全的候选。新目录消失的旧课程会保留原代码并标记 `archived`，评价仍可访问。仓库只发布有界英文摘录、中文简介及原文 SHA-256；较长原文留在忽略的抓取缓存，通过官方链接查阅。初始 `source-integrity-validation.json` 是推广前完整源文与翻译的验证记录，不是最终摘要文件的哈希。

运行 `git diff --stat`，抽查改名、学分变化、中文词典、归档数量、链接与源文。确认后提交并经 CI 发布。导入或翻译失败时保留上一份成功快照，不把半成品覆盖到线上。手动新增课程与官方后来出现同一代码时，以官方资料为准，沿用原评论。
