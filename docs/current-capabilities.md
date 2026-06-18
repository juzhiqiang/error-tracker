# Error Tracker 当前上线能力

**日期：** 2026-06-19
**范围：** 当前阶段可以写进上线文档和产品介绍的已落地能力。完整平台愿景与后续需求记录在 `docs/enterprise-readiness.md`。

## 上线定位

Error Tracker 当前是一个自托管错误监控与前端观测平台，适合需要 issue 聚合、调用栈、breadcrumbs、会话回放、Web Vitals、sourcemap、告警和 AI 辅助排障的应用团队。

当前上线文档应重点宣传已实现能力：

- 浏览器和 Node.js 运行时错误监控。
- 基于 breadcrumbs 的日志上下文，包括用户操作、路由跳转、console 输出和 HTTP 请求。
- 与错误事件关联的会话回放。
- 前端性能监控，包括 Web Vitals、resource timing、request timing 和 long task。
- 浏览器请求 trace header 传播。
- Sourcemap 上传和调用栈源码还原。
- Issue 工作流，包括分配、评论、状态流转、修复版本、合并、拆分和回归重新打开。
- 项目 webhook 告警投递。
- 基于已存储遥测数据的 AI issue 分析和性能分析。
- Error Tracker Web/API 自监控。
- 队列运维视图，包括失败任务和延迟任务。

当前不应宣称为：

- 完整日志平台。
- 完整分布式追踪/APM 平台。
- 自定义应用指标平台。
- 代码 profiler。
- Agent/LLM 监控平台。
- 自动根因定位或自动修复系统。

## SDK 能力

### Browser SDK

浏览器 SDK 当前支持：

- 全局 JavaScript 运行时错误捕获。
- 未处理 Promise rejection 捕获。
- script、style、image、link 等静态资源加载失败捕获。
- 错误事件 T0 级立即 flush。
- click、keyboard、route、console、`fetch`、`XMLHttpRequest` breadcrumbs。
- HTTP 请求 timing breadcrumbs，包含 status、duration、method、URL、transport 和 traceId。
- 请求 trace header 注入：`sentry-trace`、`baggage`、`traceparent`。
- Web Vitals 和 PerformanceObserver 采集，包括 resource timing 与 long task。
- 运行环境画像，包括 browser、OS、device、screen、viewport、network、storage、locale、timezone 和 page visibility。
- 可选 rrweb 会话回放，默认 mask 输入和可见文本。
- `beforeSend`，用于上报前丢弃或粗化字段。
- 通过 `x-error-tracker-token` header 进行 DSN token 鉴权。

### Node SDK

Node SDK 当前支持：

- uncaught exception 捕获。
- unhandled promise rejection 捕获。
- 进程退出前尽力 flush。
- release 和 environment 标记。
- 通过 `x-error-tracker-token` header 进行 DSN token 鉴权。

## API 与存储能力

API 当前支持：

- 公开 ingest endpoint，使用 DSN token 鉴权保护。
- header token 和旧版 path token 兼容。
- event 校验、payload 限制、项目级限流和每日配额基础。
- 错误事件聚合为 issue。
- 性能指标入库。
- replay 事件入库与读取。
- sourcemap 上传、存储，并按 project、release、生成文件名做源码还原。
- 服务端常见 PII 脱敏。
- 项目 token 轮换。
- API、DB、Redis/BullMQ、MinIO、队列数量和 ingest 指标健康检查。

## Dashboard 能力

Dashboard 当前支持：

- 项目创建、DSN 和 token 复制。
- Issues 列表、过滤和详情。
- 调用栈、breadcrumbs、tags、request、user、environment、release 和 SDK signals 展示。
- 有 replay 数据的事件可播放会话回放。
- Performance 页面展示 Web Vitals、网络/资源 timing 和 long task。
- Settings 中上传 sourcemap。
- Issue 分配、评论、状态更新、fixed-in-release、merge、split 和 regression。
- 告警 webhook 配置。
- 项目成员和邀请。
- Issue 详情 AI 分析和 Performance AI 分析。
- 审计日志列表和导出。
- 队列 operations 页面，支持查看失败任务并 retry/remove。
- 自监控接入文档。

## 当前缺口

以下能力故意不写入当前上线宣传，作为后续平台化方向：

- 独立日志接入、搜索和保留 UI。
- 后端分布式追踪、trace 存储、waterfall 和 service map。
- 自定义应用指标 SDK 和指标仪表盘。
- CPU/function profiling 和源码级性能归因。
- Agent/LLM 监控，包括 run、tool、token、cost 和 latency。
- 自动根因定位和自动代码修复。
- 企业 SSO、SCIM、高级合规报告和客户自管密钥。
