# 持久账户与积分记账

本文件说明 `0003_accounts_points.sql` 与账户 API 的实现约定；是否已迁移、上线及生产核对结果以本次部署报告为准。

## 身份与评价归属

- 账户主键沿用经 Google 签名、发行方、受众、nonce 和有效期验证后的 `google:<sub>`，不按邮箱、Cookie 或 session 行建立新账户。Google 回调在保存 session 的同一个 D1 batch 中创建账户；旧 session 在首次使用时惰性补建。
- 账户创建触发首次登录 +3，`first_login:<account id>` 唯一事件保证重试及同时请求不重复发放。封禁账户不会获得受保护 API 的有效身份。
- 新登录评价使用持久账户归属与独立的内部 visitor 标识。换浏览器或 Cookie 仍会编辑同一课程的既有账户评价。共享浏览器中，别的账户和匿名用户无法据访客 Cookie 编辑这条登录评价。
- 迁移不回填旧评价的账户。原匿名评价仍可由原签名 Cookie 编辑，但保持 `account_id=NULL`，不补积分。新登录账户已有同课评价时优先使用它；匿名评价不会被转移过去。
- 匿名评价沿用原来的签名 Cookie、内容去重、网络每日及每课程限制。登录评价继续使用网络限制，并以持久账户应用提交与请求限额。

## 不可变账本

`point_ledger.event_key` 唯一；`AFTER INSERT` 触发器在同一 SQL 事务内更新 `accounts.balance`。流水拒绝 UPDATE 和 DELETE；错误必须用有理由的补偿流水纠正，不能直接重写余额。

| 业务          | 唯一事件                                   | 默认变动       |
| ------------- | ------------------------------------------ | -------------- |
| 首次登录      | `first_login:<account id>`                 | +3             |
| 新登录评价    | `review_reward:<account id>:<course code>` | +10            |
| 评价撤回/隐藏 | `review_revoke:<review id>`                | 撤回原奖励     |
| 管理员调整    | `admin_adjustment:<operation UUID>`        | 管理员明确金额 |

材料事件由 `0004_materials.sql` 实现，使用同一余额触发器：`upload_reward`、`upload_revoke`、`material_unlock` 和 `material_refund`。原子扣款及建立解锁必须使用同一个 SQL/触发器或同一个 D1 batch，不能把预读余额与后写解锁分别称为事务。

评价插入和奖励由同一个触发器事务处理。奖励只在首次插入时决定：每天最多 3 门，按 **UTC 00:00** 分日；第四门当天不奖励，以后编辑也不补发。奖励撤回不腾出当天名额，账户/课程终身事件不因隐藏、撤回或恢复而重置。恢复评价不会自动重发奖励；误撤可由管理员以新、唯一操作 UUID 和明确理由补偿。

允许撤奖形成负余额。条件消费在单条 `INSERT … SELECT` 中核实有效账户及足够余额，普通解锁不能透支。后续收入先抵消欠分。

## API 与管理审计

- `GET /api/session` 的已登录 `user` 增加 `accountId`、`balance`。
- `GET /api/points?page=1` 仅返回当前账户的余额、待审首次上传潜在奖励及每页 20 条完整分页流水。已批准资料的更新不显示再次待发奖励；潜在奖励不是已到账积分。
- `POST /api/admin/points` 只允许原管理员白名单。输入为 `{accountId, amount, reason, eventId}`；`eventId` 是客户端为一次具体操作生成并在重试时复用的 UUID。金额为非零整数，单次范围 -10,000 到 10,000；理由长度 5–500。相同键和相同操作返回原结果；键与金额/账户/理由/操作者不一致时返回 409，不另发积分。
- 管理员评价 hide/restore/dismiss 均需 5–500 字理由，动作、操作者、时间、理由存入 `moderation_log`。撤回评价也在同一个 batch 中记录 owner 动作。奖励撤回触发器与评价状态更新原子执行。
- 管理员调整的完整理由与操作者保存在不可变账本内；公开课程评价不返回账户标识。

## 对账与恢复

下面查询应返回零行；材料对账另见材料运维文档。

```sql
SELECT a.id, a.balance, COALESCE(SUM(p.amount), 0) AS ledger_balance
FROM accounts a LEFT JOIN point_ledger p ON p.account_id = a.id
GROUP BY a.id
HAVING a.balance <> COALESCE(SUM(p.amount), 0);
```

恢复必须先在独立测试库演练，并核对导出 SQL 的触发器创建顺序。不要先应用所有带触发器的迁移、再把含既有 `balance` 的账户与账本行简单逐条导入：首登和账本触发器可能重新执行并重复计分。优先使用经过验证的完整快照恢复流程，恢复后以上述求和不变量与事件数量独立确认，才切回生产。

迁移前导出 D1 备份。上线后若出现异常，先暂停新上传/解锁等积分写入入口，保留不可变流水和数据库备份，按业务事件查出失败范围；只补缺失事件，避免重复发奖或用直接 UPDATE 余额掩盖问题。不要为了清理测试而删除真实账本。自动化并发测试使用临时独立 SQLite 数据库并整体删除测试库，不进入生产课程或账本。

## 已有自动化证据

`tests/points.test.mjs` 使用实际 SQLite migration 与 SQL，覆盖账户重放、匿名旧评、共享浏览器/换 Cookie 归属、每日 3 门上限、终身奖励、防透支、撤奖欠分、账本故障回滚及余额独立求和对账。并发测试以 8 个独立 Worker/SQLite 连接同时竞争首登、同课提交、撤奖、每日奖励、同事件扣款和不同事件扣款。真实 D1、部署后对象/账户验证及浏览器三语验收由部署报告分别记录，不能由这些本地测试推定。
