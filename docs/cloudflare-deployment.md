# Cloudflare 自有账户部署与登录配置

站点：https://your-domain.example  
Worker：cityu-course-radar  
数据库：cityu-course-radar-prod（绑定 DB）

## Google 登录（站长操作）

1. 在 https://console.cloud.google.com/ 新建项目 CityU Course Radar。
2. 打开 Google Auth Platform → Branding，应用名称「城课雷达」，支持邮箱和开发者联系邮箱填站长邮箱。
3. 应用首页 `https://your-domain.example`；隐私政策 `https://your-domain.example/privacy`；条款 `https://your-domain.example/terms`；授权域名填 `your-domain.example`（不带协议或子域名）。如 Google 要求验证域名所有权，使用 Search Console 的 DNS TXT 验证。
4. Audience 选择 External；处于 Testing 时添加自己的 Google 邮箱到 Test users。
5. Data Access 仅使用 `openid`、`userinfo.email`、`userinfo.profile`，不要申请 Gmail、Drive 等权限。
6. Clients → Create client → Web application。JavaScript origin 填 `https://your-domain.example`；Authorized redirect URI 必须逐字为 `https://your-domain.example/api/auth/google/callback`。
7. 保存 Client ID 和 Client Secret；不要发送密钥到聊天、提交到 Git 或截图公开。基础 Google 身份登录不需要为其他 Google Cloud 服务开通付费。
8. Cloudflare → Workers & Pages → cityu-course-radar → Settings → Variables and secrets → Add variable：添加 `GOOGLE_CLIENT_ID`（Text）以及 `GOOGLE_CLIENT_SECRET`（Secret）。保存并部署设置后登录按钮会自动启用。`APP_ORIGIN` 已配置。
9. 用测试账号完成一次真实登录；查看 `/login` 显示的 `User ID`。如要开放所有 Google 用户，回到 Audience 切换 Production，并完成 Google 提示的验证。未完成真实登录前不算 OAuth 验收通过。

官方说明：https://developers.google.com/identity/protocols/oauth2/web-server

## 管理员

管理员只由 `ADMIN_USER_IDS` 精确白名单控制，不按邮箱、名字或第一个注册者自动授予。

1. 先登录你自己的 Google 账号，再到 `/login` 复制 `google:…` 格式的 User ID（或本人 `/api/session` 返回的 user.id）。
2. Worker → Settings → Variables and secrets 添加 `ADMIN_USER_IDS`，填写该 ID；多名管理员用英文逗号分隔。保存并部署。
3. 刷新并进入 https://your-domain.example/admin 。可查看举报、隐藏评价和审计记录。
4. 撤销管理员时移除该 ID 即时生效。泄露会话时在 D1 Console 按 user_id 删除 auth_sessions 中对应行，再重新登录。

## 防护与免费额度

已在应用中实现：数据库参数绑定、严格字段校验、20 KB JSON 上限、同源写入、签名匿名 Cookie、按访客和网络限速、同课重复内容拦截、并发原子配额、撤回仍计入防刷配额、管理员白名单。Google 使用 PKCE、一次性 state、nonce、签名验证和服务端会话。HTTPS 响应设安全头；默认 Worker 域名及预览地址关闭。详细限制见 security.md。

Cloudflare 为接入的域名默认提供 DDoS 防护；这不等于能识别全部假评价。免费方案有请求/CPU/D1 配额，耗尽可导致服务中断，不承诺无限承载。校园共享网络也可能触发评价配额；有误伤再依据记录调整。

站长检查：

- Cloudflare 与 Google 账户开启双重验证并离线保存恢复码；确认域名注册邮件、续费设置及付款方式。
- 在 **域名 uwaylab.com → Security → Security rules** 查看 Free Managed Ruleset 是否启用；保留已有安全规则。
- 添加域名级 Rate limiting rule。建议先以 API 路径 `/api/`、每 IP 10 秒 30 次、Block 10 秒作为突发流量起点；以面板免费支持的字段/周期为准。如可选 Host 字段则限定 `cityuhk.uwaylab.com`。免费方案部分字段受限，若不支持 Host，规则会影响根域下其他应用的 `/api/`，有新应用时应复核。
- 不要给 `/api/*`、`/login`、`/admin` 配置 Cache Everything，也不要长期给全部访客强制挑战。匿名投票仍需举报和人工审核。
- 暂未配置 Turnstile；部署前应先实测大陆网络兼容性，不能以“有验证码”作为杜绝刷分的保证。
- 查看 Worker Metrics 与 D1 Usage；重大升级前导出数据库。免费 D1 Time Travel 保留 7 天，不能代替长期备份。

官方说明：https://developers.cloudflare.com/ddos-protection/get-started/  
https://developers.cloudflare.com/waf/  
https://developers.cloudflare.com/waf/rate-limiting-rules/  
https://developers.cloudflare.com/d1/platform/limits/

## 发布与备份

`npm ci` → `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`。

本地：`npm run db:local` → `npm run dev` → `npm run test:integration` → `npm run test:cleanup`。

正式迁移（先备份）：

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 export DB --remote --config wrangler.json --output .sites-runtime/backups/production.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --remote --config wrangler.json
npm run deploy
```

备份包含个人信息和签名密钥，需加密异地保存，不要上传 GitHub。恢复先到独立私有测试数据库验证。OAuth 流程、会话与旧域名 Cookie 不跨域迁移。

路由由 Cloudflare Dashboard 管理；wrangler.json 故意不声明 routes，避免覆盖用户已经添加的自定义域名。部署保留 Dashboard vars/secrets，源文件中 APP_ORIGIN 与 CONTACT_EMAIL 是公开配置。不要把本地 .env 中的管理员测试 ID 写入正式变量。

微信登录仍待解决个人项目的资质及平台审核，当前没有启用。Google 在中国大陆并非普遍可达，但浏览与匿名评价不依赖 Google。自定义域名不保证中国大陆各运营商的可达性；上线后需真实大陆移动网络实测。
