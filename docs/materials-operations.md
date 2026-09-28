# 资料库运维、容量与恢复

此手册描述实现接口，不代表你的部署已验收。上传默认受限，必须核对自己的套餐、账户总用量、权限和真实生产行为后再开放。没有自动病毒扫描器，格式与摘要检查不能称为病毒扫描。

## 一期边界

四类：Lecture / Tutorial / Past exam / 笔记与参考解答；学年、学期、周次筛选，50 条/页。公开目录不返回账户 ID、对象键或私有授权声明。本人可见自己的待审记录；管理员可见审核证据。资料版本的原始来源与权利声明必须与原资料完全一致，普通更新只替换文件；不同授权需另建条目，经去重与审核。完整对象 SHA-256 全站去重；相同文件不能跨课再上传赚分，已有条目链接可分享。语义相同的重编码垃圾仍须人工识别。

只接收 PDF，每份最多 50,000,000 字节。先同源认证预留，再单次 CAS 取得上传资格；对象键为服务端 UUID。PUT 要求长度匹配预留，流式计数、PDF 首尾、常见主动内容标记检查，使用 R2 `sha256` 对实际收到的完整字节校验，再读取 R2 返回大小与校验和。Worker 不缓冲整个文件。上传流 180 秒超时；恢复租约 15 分钟。没有 Content-Length 的分块请求被拒绝；响应丢失后 GET 上传状态，不能覆盖原对象。结构检查不是完整 PDF 解析器，可能拒绝含相关字样的正常 PDF，也不能发现所有混淆攻击；必须隔离、人工内容与权利审核、附件下载。

上传/下载均要求服务端 Google 会话。每次 GET/HEAD/Range 重新检查账户、资料状态和解锁关系，响应 `private,no-store`、`Vary: Cookie`、`attachment`、`nosniff` 和 sandbox CSP；不返回 presigned URL，不使用 CDN 公共缓存，不启用 `r2.dev` 或公开桶。

## 生产开通前置条件

1. Cloudflare **Storage & databases → R2 → Overview**。API 10042 表示 R2 未开通。R2 checkout 是订阅行为，须由站长理解超额计费并明确批准/操作；本任务没有代开、升级或绑定新付款方式。
2. 在同一账户清点所有 R2 桶、未完成 multipart、已有备份及其他项目占用。R2 免费额度按账户共享，无法读取账户用量时不能填“0”。保存面板用量核对日期；本应用的计数不是账户总账。
3. 开通后创建 **Standard** 私有桶 `cityu-course-materials`，Public access、r2.dev 和 custom domain 均关闭；没有需要新增 CORS 的浏览器直传。给现有 Worker 配置 `MATERIALS` R2 binding，并在 `wrangler.json` 加入 `r2_buckets: [{"binding":"MATERIALS","bucket_name":"cityu-course-materials"}]` 后构建部署。不要复制到静态公共资源目录。
4. 保留现有 OAuth secret、client ID、APP_ORIGIN 和域名。本人真实 Google 登录后从 `/login` 复制 `google:<sub>`，在现有 Worker 配置 `ADMIN_USER_IDS` 精确白名单。不得把第一个登录者自动设为管理员。确认普通账号访问管理 API 403；若缺第二真实账号，明确记录此项生产检查未完成。
5. 先保持上传关闭，并部署 `MATERIALS_UPLOAD_MODE=admin-only`，仅为受限验收暂设容量和启用 D1。用专用自建 PDF 完成生产 R2/D1、并发/异常、实际 CPU、HEAD/Range、重启和独立用量/账本核验；结束后恢复停传和容量 0。不要在真实课程生成假评价。没有生产 R2 访问不能把本地 Miniflare 结果表述为真实对象验收。
6. 面向普通用户开放前，补齐验收及套餐/额度证据，确认相应资料具有有效授权，并按下节移除 admin-only 限制。校方批量试卷许可只限制该批量导入，不阻止原创或合法授权资料入库。管理页执行完整对账（有 nextCursor 必须继续，游标在 D1 持久保存）；完成后一小时内设置容量并启用。容量取 **8,000,000,000 字节** 与账户剩余免费容量扣除安全余量后的较小值；建议至少另留 1 GB。账户共享额度变化时先停传，重新核算。

修改开关/容量、审核、恢复、下架、积分调整均要求原因并留审计。普通下载不因停传而停止；已解锁的新批准版本免费。

## 上传模式与正式开放

Worker 环境变量 `MATERIALS_UPLOAD_MODE` 是 D1 上传开关之外的限制，模板默认值为 `admin-only`。POST 预留和 PUT 文件传输都会用真实服务端会话匹配 `ADMIN_USER_IDS`；管理员仍须遵守全部文件大小、容量、限额、格式/摘要验证、审核和奖励规则。普通用户目录显示上传关闭，管理员目录还须满足 D1 开关；模式不会授权访问私有文件，也不会改变下载/下架规则。

| 环境变量实际值                             | 当前代码行为                                                 |
| ------------------------------------------ | ------------------------------------------------------------ |
| 不存在（`undefined`）                      | 保留原有公开上传资格，仍要求 Google 登录及 D1 开关等全部条件 |
| `admin-only`                               | 仅白名单管理员可预留/PUT，仍要求 D1 开关等全部条件           |
| 其他任何值，包括空字符串、`public`、`open` | 停传，POST/PUT 返回 `UPLOADS_DISABLED`                       |

**当前没有受支持的显式公开模式。** `wrangler.json` 配置 `keep_vars: true`，只从本地 `vars` 删除变量再部署，远程旧值仍可能被保留。正式放开必须先保持 D1 停传，在原 Cloudflare 账户的 Worker Dashboard 明确删除远程 `MATERIALS_UPLOAD_MODE`，同时从仓库 `wrangler.json` 删除该项，重新构建部署，并核对生产构建和已部署变量均不含该值。不要以空字符串、`public` 或 `open` 代替删除，不要关闭 `keep_vars` 以免影响其他 Dashboard 变量。最后才完成新鲜对账、设容量、打开 D1，并用真实普通账号验证目录及预留权限；仅打开 D1 不代表普通用户已获准上传。

后续可通过独立代码变更增加明确的 `public`、`admin-only`、`disabled` 三种模式，继续对未知值停传，并定义缺省值的兼容策略。这样发布可用受版本控制的显式值切换，不依赖远程变量消失。此为后续建议，当前不可按该建议直接配置 `public`；必须先实现、覆盖 POST/PUT 与目录测试，再部署。

本地测试仅在 Vite `serve` 且设置独立 `RADAR_TEST_STATE` 时，用 `RADAR_TEST_UPLOAD_MODE` 选择模式，未指定时移除本次测试配置中的模式以测原行为。普通开发继承 admin-only；生产 build 不执行此覆盖。不得将本地测试账户、状态目录或模式覆盖当成真实 Google 验收。

## 免费层与成本

2026-09-25 核对官方 [R2 价格](https://developers.cloudflare.com/r2/pricing/)：Standard 每账户每月包含 10 GB-month、100 万 Class A 和 1000 万 Class B，超额 $0.015/GB-month、$4.50/百万 A、$0.36/百万 B；直接 R2 出站免费。免费量不是绝对账单上限，按账户共享，存储平均/进位、备份、HEAD/Range/重试和其他项目都影响用量。Infrequent Access 不用于本期。

[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)列 Free 100,000 请求/日、10 ms CPU、128 MB 内存；[D1 限制](https://developers.cloudflare.com/d1/platform/limits/)列 Free 每次调用 50 查询。本实现目录用批量查询，回收每批少量对象；避免 N+1 和大循环超预算。每账户/网络对上传预留、字节传输、下载和管理操作限速，网络桶是账户桶的四倍。对账最多 120 次/小时，按页续跑；不是后台定时爬取或自动开新服务。

本地流式测试不能证明生产 Workers CPU 余量。必须在自己的实际套餐下测量一次完整上传的可归因 CPU，并核对 Workers/D1/R2 共享额度。证据不足时保持停传；不要自动升级套餐或增加付费服务。

### 单次上传 CPU 取证

仓库提供 `scripts/tail-material-uploads.mjs`，启动前可运行 `node scripts/tail-material-uploads.mjs --self-test`。运行 `node scripts/tail-material-uploads.mjs --output .sites-runtime/evidence/upload-cpu.jsonl` 后，在已有真实 Google 管理员浏览器中上传一份独立自建 PDF；保持 admin-only、小容量及原有日限额，不使用假生产会话。输出文件不能预先存在，以避免覆盖证据。

工具只保存上传 PUT 的固定脱敏路径、结果、HTTP 状态、时间戳及存在时的 CPU/wall 毫秒值，丢弃 URL 后缀、Cookie、请求头和原始日志。缺失耗时记 null。安全计数能区分没有事件和事件未匹配；它不是上传验证器。必须将真实上传时间、成功状态、D1 验证记录与 R2 文件摘要相互核对，不能用匿名 401 的 CPU 或全站聚合 P99 代替大文件实测。按 Ctrl-C 结束，工具也会在 10 分钟后自动清理临时 tail；若报告 cleanup_unconfirmed，先处理残留会话。此步骤不启用持久 Workers Logs、不升级套餐。

Workers 套餐可从原账户的 [Workers Plans](https://dash.cloudflare.com/?to=/:account/workers/plans) 只读确认；不要点击升级或修改付款。未取得可用套餐和 CPU 余量证据时继续停传。完成测试后按精确夹具清理流程撤奖、删除对象和释放容量，保留审计。

## 对账与失败恢复

`POST /api/admin/materials/operations`：

- `{"action":"settings","uploadsEnabled":false,"capacityBytes":0,"reason":"..."}` 停传。容量可减少；启用必须已有完整新鲜对账、实际桶绑定及正数限额。
- `{"action":"reconcile","reason":"..."}` 从头扫描；后续携带返回的 `cursor`。会先停传、清空完成标记，用服务端游标和短租约避免并行假完成。全部页完成后才记 reconciled_at。操作失败保持关闭。
- 过期 reserved、failed、rejected 清理前先 CAS 状态；R2 删除确认后才释放 held_bytes。D1 更新失败保留容量，下轮重试；未知对象先计为孤儿，只有自有 `quarantine/<uuid>.pdf` 且无合法引用的对象可清理。其他未知键不擅删、持续占额。approved 对象不走回收。
- `{"action":"recover_upload","uploadId":"...","reason":"..."}` 处理过期 uploading：完整对象重新全流核验后恢复 quarantined，必须重新审核；完整对象与另一版本摘要重复时也转 abandoned 并记录 DUPLICATE_FILE；唯一约束失败后的补偿使用条件更新和同批审计，保留原对象及容量。不能证明写入终止的对象转 abandoned，仍占全部容量，不能下载/审批。晚到回调不能改变此状态，不释放未知容量。不会因为一次 R2 HEAD 不存在就声称不会有迟到写入。
- abandoned 是站长调查待办：先保持停传，确认相关请求已终止、备份 D1、核对对象清单与版本记录后，由有 R2/D1 权限的运维清理指定对象；确认删除后，带理由写 material_audit 并把该版本改 deleted/held_bytes=0。此动作不能用于 approved/quarantined，也不能删除积分流水。恢复前应先在测试桶复现。没有可确认终止的证据就保留预留，允许其余已核算容量继续使用。

R2 和 D1 没有跨服务事务。这里通过不可覆盖对象、显式状态、保守预留、可重入清理和人工异常尾部处理降低故障影响，不能声称任何故障都自动解决。R2 强一致性及条件写的生产竞争行为仍需实际验收；不拿本地模拟器代替官方保证。

### 自建生产验收材料的精确清理

已批准的自建测试材料应使用专门流程清理，不能套用上面的 abandoned 回收或删除真实资料。只操作唯一 synthetic 课程及其精确版本，先结束上传请求，通过真实管理员 API 停传/容量归零并留理由，再通过业务永久下架撤奖；如有买家，须先验证业务退款。核对余额与不可变账本一致，保存私有备份后，删除精确 R2 键并独立确认不存在，保存带时间、对象键和验证结果的私有 proof。

数据库清理须事先独立审查：以原 owner、synthetic 课程标记、精确版本/大小/SHA、已下架、已撤奖、停传审计和新鲜删除 proof 为条件，单个 D1 batch 新增证明审计、将版本标 deleted/held_bytes=0、清空材料 current_version、删除唯一测试课程，再写完成审计。任何意外版本、评价、购买/举报或状态变化必须停止处理；不能删除账户、账本或先前审计。保留 taken_down 材料墓碑；对象没有确认删除前不释放容量。执行后独立读回并完成全桶对账，确认公开目录无夹具。

## 积分、下架与投诉

规则和 SQL 对账见 [points-accounting.md](points-accounting.md)。首次登录 +3，新登录新评 +10（UTC 每日最多三门，同课终身一次），批准上传 +50（每天/同时待审各最多三次），首次解锁 -1。事件键唯一，余额随不可变账本触发更新；扣款与解锁在同一 SQL 内完成。管理员永久下架撤奖并向付费解锁者一次退款，恢复再下架不会二次补贴。普通版本更新不奖励。余额可因撤奖为负，负数不能再解锁。

举报可以匿名提交，目录不公开举报者。举报本身不自动下架；管理员查看、处置、关闭并审计。站长联系邮箱通过 `CONTACT_EMAIL` 配置，不自动发邮件。文件与人工理由不翻译，系统状态/操作界面三语显示。

## 官方试卷与许可

[官方试卷入口](https://www.cityu.edu.hk/lib/digital/exampaper/index.htm)要求当前城大师生身份，在学校网站用 EID/AD-LAN 登录；本站不收集或代理学校密码。每门课资料页免费直达 LibraryFind 的本课程代码试卷检索，不扣积分，无需本站登录；无结果时可用[按学年与院系浏览](https://www.cityu.edu.hk/lib/digital/exampaper/ftlist.htm)入口。

2026-09-28 已在浏览器读取官方入口、学年列表与 LibraryFind。链接由 `lib/official-exams.ts` 统一生成：沿用官方学年链接的机构 `852JULAC_CUH:CUH`、范围 `MyInstitution` 和试卷短语，再以 AND 加入精确课程代码；使用系统文档支持的[高级检索链接格式](https://developers.exlibrisgroup.com/primo/apis/deep-links-new-ui/)。这也与实际高级检索 UI 生成的 URL 一致。不要用普通的 `set("query", ...)` 覆盖已有条件，不接受任意 URL、主机或查询表达式。

实测 CS2116 命中 2024–25、2025–26 两个院系/学年索引；2025–26 记录 `alma991030070331503408` 的 Contents 明确列出 CS2116、CS6382、GE2340。CS5296 在未登录会话中显示无记录，不据此断言没有试卷。链接只检索公开索引，不保证每门课或每学期都有馆藏；记录通常按院系/学年归档，仍需在官方站内选择试卷并完成学校认证。没有验证或下载受限 PDF。

`data/official-exam-index.json` 保存核验日期、入口与已读取的公开索引定位依据；`papers` 数组仍为空。未取得覆盖下载、站外保存、向本站用户分发与期限的书面许可，**批量 PDF 入库未完成，导入数量 0**。`GET/POST /api/admin/materials/import` 提供状态与 dry_run，仅报告缺许可，不执行下载。未来许可需单独核验并实施受限导入器，不因填入一个布尔值就视为取得许可。

## 备份、迁移与回滚

迁移前导出 D1 到本地 Git 忽略目录，限制文件权限。备份含身份及安全数据，不可提交、贴到聊天或放公开桶；本站密钥不写代码。正式使用 append-only 0003/0004，不改旧迁移、不删原评价。部署保留 Dashboard vars/secrets 及域名，不用旧 Sites。

异常先关闭上传和涉及问题的资料，保留审计/账本。代码可回滚到前一 Worker 版本；新增表/列保留，不能回滚删除财务记录或直接覆盖余额。恢复备份先在独立私有 D1/测试桶检查，不能盲目覆盖正在写入的生产库。R2 备份副本也计入账户费用。
