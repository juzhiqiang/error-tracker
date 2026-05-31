# Task P3-02: SDK 可靠性队列

**计划：** Plan 3  
**依赖：** P3-01 可并行  
**目标：** 为 SDK 增加可测试的 retry/backoff 和浏览器本地持久化队列基础能力，降低刷新/短暂网络故障导致的事件丢失。

## 验收标准

- `EventQueue.flush()` 在 flush 失败时保留 batch 并可重试。
- 支持配置 `maxRetries`、`retryDelayMs`。
- 浏览器环境可选 `persist: true`，使用 localStorage 存储队列快照。
- Node/无 localStorage 环境不报错。

## 文件

- Modify: `packages/sdk/src/types.ts`
- Modify: `packages/sdk/src/core/queue.ts`
- Modify: `packages/sdk/src/core/client.ts`
- Test: `packages/sdk/src/__tests__/queue.test.ts`
- Test: `packages/sdk/src/__tests__/client.test.ts`

## 步骤

- [ ] 写 queue 失败测试：第一次 flush 失败后队列不丢事件，第二次成功发送同一事件。
- [ ] 写 queue retry 测试：配置 `maxRetries: 2` 后第三次成功。
- [ ] 写 persistence 测试：enqueue 后写入 localStorage，重新创建 queue 可恢复事件。
- [ ] 扩展 `EventQueue` 构造参数，保持现有调用兼容。
- [ ] 在 `ErrorTrackerClient` 中读取 `queue` 配置并传入 `EventQueue`。
- [ ] 运行 `bun test packages/sdk/src/__tests__/queue.test.ts packages/sdk/src/__tests__/client.test.ts`。
- [ ] 运行 `cd packages/sdk && bun run lint && bun run build`。
- [ ] 提交：`feat: 增强 SDK 队列可靠性`
