# Task P6-01: 平台自监控

**目标：** 让平台自身的 Web 控制台和 API 服务可以通过现有 ingest/DSN 链路上报错误与 Web Vitals，便于在本平台内观察自己的问题。

**范围：**
- Web：根布局挂载自监控 Provider，读取 `NEXT_PUBLIC_ERROR_TRACKER_DSN`，启用 SDK 默认浏览器错误、Breadcrumbs 和 Web Vitals 采集。
- API：新增 self-monitoring 模块，全局捕获 5xx/未处理异常并 POST 到 `ERROR_TRACKER_DSN`。
- 安全：默认无 DSN 不启用；支持显式关闭；API 跳过 `/ingest`，避免递归上报。
- 文档：补 `.env.example` 与生产部署说明。

**不包含：**
- 后端 APM/Tracing、数据库慢查询、分布式链路追踪。
- 自动把性能指标生成 Issue 或性能告警。

- [x] Step 1: 写 Web/API 自监控 RED 测试
- [x] Step 2: 实现 Web 自监控配置与 Provider
- [x] Step 3: 实现 API SelfMonitoringService 与全局异常过滤器
- [x] Step 4: 补充环境变量与部署文档
- [x] Step 5: 运行测试、lint、build 验证
- [x] Step 6: 提交变更
