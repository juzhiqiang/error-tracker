# 上线就绪评估报告

**日期:** 2026-06-11
**评估人:** Claude Code
**范围:** 单元测试 / 类型检查 / 全量构建 / E2E 回归 / 实时上报链路 / 上线检查清单核对
**环境:** 本地全栈(Docker：PostgreSQL + MinIO + Redis 均 Up；API :3002、Web :3003 在跑)

## 结论

- **功能层面:可以上线。** 核心链路(DSN 鉴权、事件上报、双 token 形态)实测正常,类型检查与构建干净,生产环境安全校验到位。
- **发布纪律层面:未达标。** `bun run test` 与 `bun run e2e` 当前均为红色,存在三处**测试工程缺陷**(非生产代码缺陷)。带红色 CI 上线等于放弃回归防线,需先修绿。
- 这与 `CLAUDE.md` 中"单元测试、API/Web 类型检查、全量构建均通过"的表述**不一致**——该表述对 SDK(52 pass)、类型检查、构建成立,但对完整单测套件与 E2E 不成立。

## 通过项(有据)

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `bun run lint` | **6/6 包通过**(api/web/sdk/cli/react + 根) |
| 全量构建 | `bun run build` | **5/5 通过**(api+web+sdk+cli+react) |
| SDK 单元测试 | `bun test`(packages/sdk) | **52 pass / 0 fail** |
| 生产 env 安全校验 | `apps/api` env.test.ts | 通过:拒绝非 HTTPS CORS、通配符 CORS、非 HTTPS auth URL、默认/短 `BETTER_AUTH_SECRET` |
| 实时上报(token in path) | `POST /ingest/:id/:token` | **202** |
| 实时上报(token in header,SDK 形态) | `POST /ingest/:id` + `x-error-tracker-token` | **202** |
| 鉴权拒绝(错误 token) | `POST /ingest/:id` + 错误 header | **401** |
| 运维文档 | `docs/operations/` | 部署 / 备份恢复 / 恢复演练 / 容量基线 4 篇齐全 |
| 数据库迁移 | `apps/api/drizzle/` | 12 个 SQL 迁移在位 |

## 待修问题(三处,均为测试工程缺陷,非生产代码 bug)

### 1. `bun run test`(turbo)整体失败 —— 阻断 CI

`@error-tracker/react` 包仅有 [packages/react/src/index.tsx](../../packages/react/src/index.tsx),**无任何测试文件**。其 `test` 脚本为 `bun test`,在无用例时 exit 1(`No tests found!`),turbo 链路随之中断(`2 successful, 5 total`,`Failed: @error-tracker/react#test`)。

- **影响:** 文档中推荐的 `bun run test` 命令无法跑绿;一个标记为 `"private": false`(待发布)的 React 适配器零测试覆盖。
- **修复建议:** 为 `packages/react` 补一个最小冒烟测试(渲染 ErrorBoundary、捕获并上报),或在无用例前提下调整 test 脚本策略。

### 2. API 单测「一起跑塌、单独跑过」—— 测试结果不可信

根目录 `bun test`:**180 pass / 37 fail / 13 errors**(217 across 66 files)。
`apps/api` 单独 `bun test`:**142 pass / 12 fail / 5 errors**(154 across 43 files)。
但失败文件**单独运行全部通过**(已实测 `sourcemaps.controller.test.ts`、`queue-operations.controller.test.ts` 各 2 pass / 0 fail)。

- **根因:** [apps/api/src/modules/ai/ai-advisor.controller.test.ts:7](../../apps/api/src/modules/ai/ai-advisor.controller.test.ts#L7) 用 `mock.module('@nestjs/common', …)` 整体替换模块,却**漏掉 `Logger`** 等导出。Bun 的 `mock.module` 全局且跨文件持久,该文件一旦执行,后续所有依赖真实 `Logger` 的测试即报 `TypeError: undefined is not a constructor (evaluating 'new common_1.Logger(...)')`。
- **影响:** 产生 12 个假阴性,更危险的是**可能掩盖真实失败**,使整个 API 单测结果不可信。
- **修复建议:** 在该 mock 中补全 `Logger`(及其它被引用的导出),或改用按需局部 mock / 在 `afterAll` 还原模块,避免全局污染。

### 3. E2E `production smoke path` 失败 —— 过时测试

[apps/web/e2e/error-tracker.spec.ts:27-29](../../apps/web/e2e/error-tracker.spec.ts#L27) 用 `page.locator('input[readonly]').first().inputValue()` 期望读到**单串 DSN** `/ingest/{projectId}/{token}`,正则 `/\/ingest\/([^/]+)\/([^/]+)$/` 匹配为 null 而失败。

- **根因:** settings 页 [apps/web/src/app/(dashboard)/settings/page.tsx:78](../../apps/web/src/app/\(dashboard\)/settings/page.tsx#L78) 已将 DSN 展示**拆分**为「Ingest URL(不含 token)」+「独立 token 框」两个字段(分别在第 459、476 行),测试未随 UI 改版更新,`.first()` 抓到的是不含 token 的 Ingest URL。
- **为什么不是产品 bug:** SDK 双形态兼容 —— [packages/sdk/src/transports/dsn.ts](../../packages/sdk/src/transports/dsn.ts) 解析内嵌 token、[packages/sdk/src/transports/http.ts:11](../../packages/sdk/src/transports/http.ts#L11) `token ?? parsed.token` 优先用独立 token 并经 `x-error-tracker-token` header 发送;API [dsn-auth.guard.ts:14](../../apps/api/src/common/guards/dsn-auth.guard.ts#L14) 同时接受 header 与路径 token。已实测两种形态上报均 202、错误 token 401。
- **修复建议:** 测试改为从两个字段分别取 Ingest URL 与 token 再拼装,或直接断言 settings 生成的接入片段。
- **附带:** `CLAUDE.md` 的「DSN 格式」与 SDK 初始化示例仍只写单串内嵌形态,建议补充 split(`dsn` + 独立 `token`)形态说明,与 Dashboard 实际生成的片段对齐。

> E2E 其余用例(welcome 首屏 2 条)通过;失败仅此 1 条。

## 上线前检查清单核对(对照 CLAUDE.md)

- [x] 代码功能就绪(鉴权 / 上报 / 多租户隔离 / 审计 / sourcemap CI 等已落地)
- [x] 类型检查与全量构建干净
- [x] 生产 env 强制校验生效(非 HTTPS / 弱 secret 拒绝启动)
- [ ] **完整测试套件跑绿**(受问题 1、2 阻塞)
- [ ] **E2E 跑绿**(受问题 3 阻塞)
- [ ] 准备生产 `.env`:`NODE_ENV=production`、32+ 位随机 `BETTER_AUTH_SECRET`、HTTPS 的 `BETTER_AUTH_URL` / `CORS_ORIGIN`(精确白名单)
- [ ] 反向代理终止 TLS,转发 `X-Forwarded-Proto/Host/For`
- [ ] 生产库执行 `bunx drizzle-kit migrate`
- [ ] 落实 PostgreSQL / MinIO / Redis 备份与恢复

## 建议

三处问题均为小修复,且不触碰生产代码逻辑。建议在宣布"测试通过 / 达到上线标准"前先修绿问题 1–3,再补齐清单中的生产配置项。修复后重跑:`bun run lint`、`bun run test`、`bun run e2e`,并更新 `CLAUDE.md` 的状态表述与 DSN 格式说明。
