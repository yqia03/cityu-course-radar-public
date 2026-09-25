# D1 migrations 与 Drizzle schema 维护

部署使用 Wrangler 的 D1 migration runner，按 `drizzle/*.sql` 追加执行；它是生产迁移的权威来源。`db/schema.ts` 描述课程、评价、认证、账户与账本，`db/material-schema.ts` 描述资料表；`db/index.ts` 将两者合并供类型安全查询使用，`drizzle.config.ts` 同时包含两份 schema。

`0003_accounts_points.sql` 和 `0004_materials.sql` 是手写迁移，包含 Drizzle 表结构无法完整表达的余额、首登、评价奖励、上传容量、审批发奖、解锁与退款触发器，以及默认关闭上传的设置种子。因此不能把“ORM schema 可编译”当作 SQL 行为已验证，也不能用自动生成的重建表迁移替换这些触发器。

现有 `drizzle/meta` 历史快照仅到 `0002`。本次没有运行 `drizzle-kit generate`、没有重写既有历史快照或已部署迁移。`npm run db:generate` 现已改为安全提示并退出，不再调用生成器。**在同步新的工具快照并复核前，不应直接运行 `drizzle-kit generate`**，否则它会把本次已手写的表误认为尚未迁移。不要将这类重复创建表 SQL 部署到现有 D1。

后续变更应遵循：

1. 先核实生产 `d1_migrations` 与备份，再追加下一个编号的 SQL 文件，保留既有资料、评价和不可变账本。
2. 同步对应 Drizzle 声明。若改变重建表的列或约束，显式迁移原数据并保留/重建相关触发器；不要只检查表名和列名。
3. 运行全部 SQLite migration 测试，特别是 `tests/points.test.mjs`、`tests/material-accounting.test.mjs`；随后在独立本地 D1 中执行实际 migrations 和 HTTP integration。
4. 若将来启用 Drizzle 自动生成，先在隔离临时目录生成当前完整 schema 的基线快照，并人工对照所有表、索引、FK、CHECK 与触发器清单；只引入经过审查的新元数据，不编辑已上线 SQL。再次生成必须得到空表结构差异，才可把它作为未来变更的辅助工具。

可用以下查询核对数据库实际触发器，结果不应因为一次 ORM 生成操作而消失：

```sql
SELECT name, tbl_name, sql
FROM sqlite_master
WHERE type='trigger'
ORDER BY name;
```

积分账户与账本的独立求和对账见 [积分记账说明](points-accounting.md)。失败恢复不得通过直接删除账本或改写余额掩盖不一致。
