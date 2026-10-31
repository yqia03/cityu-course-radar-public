# 开发指南

[返回项目介绍](../README.md) · [English introduction](../README.en.md) · [贡献指南](../CONTRIBUTING.md)

这里集中说明本地启动、验证、数据维护和独立部署。只想查课或写评价，可以直接[访问城课雷达](https://cityuhk.uwaylab.com)。

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
npm run lint
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

资料库专项检查使用独立的本地环境：

```sh
npm run test:materials
```

CI 的完整执行顺序见 [Validate 工作流](../.github/workflows/ci.yml)。本地模拟检查不代表生产登录、私有对象存储或上传功能已经验收。

## 更新官方课程与翻译

详见[数据维护流程](catalogue.md)。导入器只读取城大官方公开页面，带缓存、限速、重试和覆盖率报告。中文简介取官方简介的首句，完整原文通过官方链接查阅，仓库保留对应英文摘录与原文哈希；少量 HTML 缺失通过官方 PDF 回填并记录来源。所有中文译文仍应视作待人工复核。

人工校正写入 `data/translation/` 的词典；不要直接批量改写生成快照。更新先生成候选文件，验证来源、课程数量与翻译覆盖率，再查看 Git 差异并发布。已有代码从新目录消失时归档保留，避免丢失评价。

外部课程心得的来源、量表和同步规则见[外部评价维护](external-reviews.md)。外部评分不与本站评分合并。

## 项目结构

```text
app/                    页面路由与服务端 API
components/             三语课程界面及共享 UI
lib/                    课程查询、校验、身份与评分规则
db/ + drizzle/          数据库定义与不可变迁移
data/                   官方课程快照、导入报告和翻译词典
scripts/catalogue/      可复用抓取、PDF 补全、翻译和校验
scripts/                本地开发、构建与公开导出支持
tests/                  规则、数据库与真实 API 测试
docs/                   架构、开发、数据维护、部署与运营
.github/                CI、依赖更新与贡献模板
README.md               中文项目介绍
README.en.md            英文项目介绍
```

模块和权限边界见[架构说明](architecture.md)，数据库变更见[迁移指南](database-migrations.md)。

## 独立部署与日常维护

项目使用 React/Vinext，部署在 Cloudflare Worker + D1；站内文件使用私有 R2。正式站点为 <https://cityuhk.uwaylab.com>。

公开仓库提供经过筛选的源码快照，不包含生产账户配置、用户数据、密钥或私有提交历史。独立部署需要自己的 Cloudflare 资源和 Google OAuth 配置，详见：

- [公开仓库与同步规则](public-repository.md)
- [Cloudflare 部署与登录配置](cloudflare-deployment.md)
- [运营手册](operations.md)与[安全说明](security.md)
- [资料库运维](materials-operations.md)与[积分账本规则](points-accounting.md)

资料上传默认受限，部署前须按资料库运维文档完成自己的验收。官方试卷检索入口不等于已取得 PDF 批量下载或分发许可。

公开 CI 负责验证，不承担生产部署。旧 `.openai` 和 `build/sites-*` 文件仅保留迁移历史，不参与当前生产构建。

## 维护项目介绍

中文 [README](../README.md) 与[英文版](../README.en.md)保持相同的功能范围、状态和链接。截图保存在 `docs/images/course-browser.png`，应取自未登录的公开页面，更新后同步两版的截图日期。上传开放状态或课程快照发生变化时，也要同步更新两版说明。

公开导出只允许这张已审查的演示截图，不包含后台、账户、生产验收证据或任意图片目录。新增公开文档或配图时，同步检查 `scripts/export-public.mjs` 的允许列表。
