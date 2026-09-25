# 城课雷达 · CityU Course Radar

香港城市大学的独立三语课程评价社区。灵感来自课程避雷榜：用学生的真实经历帮助下一位同学选课。

- **免登录评价**：访客可浏览、评分、评论及举报；课程体验选填，没有字数门槛，同一浏览器可更新自己的评价。
- **登录补课**：通过 Google 登录后补充遗漏课程，服务端验证身份与重复课程代码。
- **官方课程库**：2026/27 官方本科及研究生目录，4,422 个不同课程代码，包含 170 门通识课。目录收录不代表当期开课。
- **简中 / 繁中 / English**：课程名称与简介提供机器辅助中文译文，保留原文、来源、模型信息与人工校对词典。用户评论保留其原始语言。
- **真实榜单**：至少 3 条可见评价进入好课榜 / 避雷榜，初始数据库没有示例评分。
- **可持续维护**：数据库迁移、官方数据导入、离线翻译、质量报告、自动测试、GitHub CI、依赖更新与运营文档。

## 公开源码

公开仓库：[cityu-course-radar-public](https://github.com/yqia03/cityu-course-radar-public)。喜欢本站，欢迎点个 Star。此仓库为经过筛选的源码快照，不包含生产账户配置、用户数据、密钥或私有提交历史。部署前请按 [公开仓库说明](docs/public-repository.md) 配置自己的 Cloudflare 资源。

## 本地启动

需要 Node.js 24+（最低 22.18）、npm、Python 3.11+。网页运行不需要翻译模型或付费 API 密钥。

```sh
npm ci
cp .env.example .env
npm run db:local
npm run dev
```

打开开发服务器打印的地址（默认 `http://localhost:5173`）。数据来自已提交的快照，不必先抓取官网。`npm run db:local` 仅操作本地 D1，重复执行会跳过已应用的迁移。

本地集成测试直接向隔离 D1 写入短期测试会话，不提供模拟登录接口。生产登录使用 Google OAuth 和数据库会话；管理员使用 `ADMIN_USER_IDS` 精确白名单。

## 验证

```sh
npm run typecheck
npm test
python3 -m unittest discover -s scripts/catalogue -p 'test_*.py'
npm run format:check
npm run build
```

在本地预览运行时执行真实接口集成检查；测试拒绝连接非 localhost 站点：

```sh
npm run test:integration
npm run test:cleanup
```

集成测试会创建带 `ZZTEST` 前缀的临时课程，验证匿名评价、登录权限、并发去重、输入校验、排名门槛、举报与限流；清理 SQL 仅针对本轮课程。生产数据库没有测试数据。

## 更新官方课程与翻译

详见 [数据维护流程](docs/catalogue.md)。导入器只读取城大官方公开页面，带缓存、限速、重试和覆盖率报告。中文简介取官方简介的首句，完整原文通过官方链接查阅，仓库保留对应英文摘录与原文哈希；少量 HTML 缺失通过官方 PDF 回填并记录来源。所有中文译文仍应视作待人工复核。

人工校正写入 `data/translation/` 的词典；不要直接批量改写生成快照。更新先生成候选文件，验证来源、课程数量与翻译覆盖率，再查看 Git 差异并发布。已有代码从新目录消失时归档保留，避免丢失评价。

## 项目结构

```text
app/                    页面路由与服务端 API
components/             三语课程界面及共享 UI
lib/                    课程查询、校验、身份与评分规则
db/ + drizzle/          数据库定义与不可变迁移
data/                   官方课程快照、导入报告和翻译词典
scripts/catalogue/      可复用抓取、PDF 补全、翻译和校验
scripts/                本地开发与构建支持
tests/                  规则、数据库与真实 API 测试
docs/                   架构、数据维护、部署与运营
.github/                CI、依赖更新与贡献模板
```

## 发布与 GitHub

项目部署在自有 Cloudflare Worker + D1，正式地址为 https://cityuhk.uwaylab.com 。部署、Google 登录及安全配置见 [部署手册](docs/cloudflare-deployment.md)；日常维护见 [运营手册](docs/operations.md)。旧 `.openai` 和 `build/sites-*` 文件仅保留迁移历史，不参与当前生产构建。

## 来源与许可

- [城大本科官方课程目录](https://www.cityu.edu.hk/catalogue/ug/current/catalogue/B/B_course_index_full.htm)
- [城大研究生官方课程目录](https://www.cityu.edu.hk/catalogue/pg/current/catalogue/TP/TP_course_index_full.htm)
- [参考：墨大课程避雷榜](https://unimelbwall.com/worst-ten)

独立学生项目，与香港城市大学无隶属关系。项目自有代码使用 MIT；官方课程资料及第三方组件、翻译模型各自保留其权利与许可，参见 [第三方说明](THIRD_PARTY_NOTICES.md)。

## 外部评价

课程卡片和详情提供小红书、Dcard 和公开课程心得的来源参考，不单设平台参考分类。原帖评分与本站匿名评分分开，保留量表、日期和链接。维护方法见 [外部评价维护](docs/external-reviews.md)。公开源码及同步规则见 [公开仓库说明](docs/public-repository.md)。
