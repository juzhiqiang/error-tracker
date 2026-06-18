# Error Tracker 企业化就绪度与完整平台调研

**日期：** 2026-06-19
**范围：** 当前仓库在 Plan 1、Plan 2、Plan 3、Plan 4 及观测链路补强后的能力边界，以及后续完整监控平台能力调研。

## 摘要

当前系统适合内部试点、小型自托管团队，以及由团队自行控制部署、数据访问和运维边界的单组织应用排障场景。

现阶段不应宣称为“完整企业级生产平台”。项目已经具备错误监控、前端性能监控、会话回放、sourcemap、告警、基础治理和自监控能力，但完整企业级平台通常还需要更完善的身份治理、审计、可用性、租户隔离、合规、日志、分布式追踪、自定义指标和自动化根因分析能力。

## 当前企业化边界

当前已包含：

- Browser 和 Node SDK 上报链路，支持重试、批量、去重、breadcrumbs、会话回放和 Web Vitals 采集。
- Ingest DSN token 鉴权，支持 `x-error-tracker-token` header。
- Ingest 和 replay 请求结构校验与 payload 防护。
- Issue/event 聚合、调用栈展示、breadcrumbs、replay 播放、性能页面、sourcemap 查询和告警/清理任务。
- 按 project、release、生成文件名匹配 sourcemap。
- replay 对象清理。
- ingest body size 防护、项目级限流基础和每日配额基础。
- 项目 DSN token 轮换。
- 服务端 PII 脱敏，覆盖 event user、request、breadcrumb、tag、context 等常见字段。
- BullMQ 失败任务保留和队列数量可视化。
- `GET /health` 覆盖 API、DB、Redis/BullMQ、MinIO、队列数量和 ingest 指标。
- PostgreSQL、MinIO、Redis/BullMQ 备份恢复文档。
- 项目成员、邀请、RBAC、审计日志、自监控、AI 辅助分析等基础能力。

当前不应作为完整企业能力宣传的部分：

- 完整日志平台，包括独立日志接入、搜索、保留策略和日志告警。
- 完整分布式追踪/APM，包括后端 span、trace waterfall、service map 和跨服务查询。
- 自定义应用指标平台，包括 counter、gauge、histogram、维度、仪表盘和指标告警。
- CPU/function profiling 和代码行级性能归因。
- Agent/LLM 监控，包括 agent run、tool call、token、cost 和模型调用链路。
- 自动根因定位和自动修复闭环。
- 企业 SSO、SCIM、高级合规报告和客户自管密钥。

## 企业化就绪度矩阵

| 领域 | 当前状态 | 企业级期望 | 建议 |
| --- | --- | --- | --- |
| Ingest 安全 | 部分具备 | payload 限制、鉴权、限流、滥用防护、token scope | 将内存限流升级为 Redis 分布式限流，增加滥用监控面板。 |
| SDK 可靠性 | 部分具备 | 离线恢复、持久重试、低性能开销、可观测的投递状态 | 浏览器持久化升级为 IndexedDB，增加退避抖动和投递遥测。 |
| Sourcemap | 部分具备 | 精准 artifact 匹配、上传校验、release artifact 生命周期 | 增加 artifact bundle 校验、checksum 和 release 级 artifact UI。 |
| 身份与访问控制 | 部分具备 | 组织、团队、RBAC、SSO、最小权限 | 继续补齐企业 SSO、SCIM 和更细粒度权限。 |
| 审计 | 部分具备 | 管理、访问、数据查看、token 操作和工作流动作审计 | 扩展 replay 访问、token 使用、登录和敏感操作审计。 |
| 隐私与数据治理 | 部分具备 | PII 脱敏、字段 denylist、保留策略、导出/删除工作流 | 增加项目级字段策略、replay masking UI 和数据删除/导出流程。 |
| 可用性与恢复 | 部分具备 | HA 服务、备份、恢复演练、DLQ、SLO 面板 | 自动化恢复演练，补充 HA 部署拓扑和 SLO 告警。 |
| 平台自身观测 | 部分具备 | health、metrics、traces、logs、alerting | 增加 Prometheus 指标、结构化日志和 error budget 告警。 |
| 租户隔离 | 部分具备 | 组织级数据隔离和权限边界 | 对所有数据模型和查询持续强化 organization scope。 |
| 运维管理 | 部分具备 | 运行手册、迁移回滚、环境校验 | 增加部署 runbook、migration rollback 和启动配置校验。 |

## 完整平台需求调研

本节记录完整产品愿景，避免当前上线文档把未来能力误写成已上线能力。下面能力并非全部已实现，而是后续规划和实施计划的输入。

| 能力 | 产品目标 | 当前状态 | 后续方向 |
| --- | --- | --- | --- |
| 错误监控 | 自动捕获异常、资源加载失败、堆栈、release、environment、用户上下文，并聚合 issue。 | 已具备 | 优化分组控制、告警路由、责任人工作流和回归检测。 |
| 日志记录 | 查看错误和性能问题前后的日志上下文。 | 部分具备 | 增加独立 log event 类型、日志接入 API、保留策略、搜索过滤 UI，以及与 issue/trace 的关联。 |
| 会话回放 | 回放真实用户出错前后的操作过程，同时保护敏感输入和页面区域。 | 已具备 | 增加采样策略、用户授权 hook、保留策略、回放搜索和隐私审查工具。 |
| 追踪 | 找出瓶颈、错误请求，并理解应用端到端流程。 | 部分具备 | 增加 trace 存储、span 接入、service map、waterfall、后端 instrumentation 和跨服务查询。 |
| 应用指标 | 用自定义指标追踪应用性能和业务使用情况随时间变化。 | 部分具备 | 增加 counter、gauge、histogram、维度、指标告警、仪表盘和 cardinality 防护。 |
| 分析 | 找出导致性能或可靠性问题的函数、文件和代码行。 | 部分具备 | 增加 profiler 接入、源码级性能归因、更强的 sourcemap artifact 映射和 release 对比分析。 |
| 代理监控 | 跟踪 agent 运行、错误率、LLM 调用、token 使用、工具执行、延迟和成本。 | 未具备 | 定义 agent run/span schema、LLM 使用量接入、tool call telemetry、成本聚合和 agent 专属仪表盘。 |
| 先知 | 捕获重大变更，推断生产问题根因，并建议或自动修复遗漏问题。 | 调研阶段 | 先整合部署元数据、trace、log、metric、issue、代码归属、AI 分析和人工审批；第一阶段只做建议型 RCA，不做自动改代码。 |

### 后续能力说明

- 完整日志应成为一等信号，而不是只作为错误事件上的 breadcrumbs。
- 完整追踪需要后端 span 接入与存储；当前浏览器 trace header 主要用于传播和关联。
- 自定义应用指标应独立于 Web Vitals，业务指标和运行时指标需要不同的保留策略和维度控制。
- Profiling 和代码行级分析应依赖 release artifact 与 sourcemap，不要求公开 sourcemap。
- Agent 监控需要独立领域模型，因为 LLM call、tool execution、token 和 cost 不适合直接塞进浏览器错误事件。
- “先知”类自动化必须有置信度、审计日志、回滚策略和人工审批；第一个可用里程碑应是建议型根因分析，而不是自动提交修复。

## 推荐路线图

1. 日志平台基础：log event、日志接入 API、搜索过滤、保留策略、与 issue/trace 关联。
2. APM 追踪基础：span schema、后端 SDK、trace 存储、waterfall、service map。
3. 自定义指标基础：metric SDK、聚合存储、维度治理、指标图表和告警。
4. Profiling 与代码分析：profiler 数据、源码归因、release diff、热点函数视图。
5. Agent/LLM 监控：agent run、LLM call、tool call、token、cost、错误率和延迟面板。
6. 先知/RCA：变更关联、根因候选、修复建议、人工审批、审计和回滚。

## 对外定位建议

建议使用：

> 面向内部评估和可控自托管试点的错误与前端观测平台。

避免使用：

> 完整企业级 APM / 日志 / 指标 / 自动修复平台。

当前系统已经能展示核心产品价值，但完整企业买家通常还会要求日志、追踪、指标、身份、审计、隐私、合规和高可用能力。
