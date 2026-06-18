# @error-tracker/sdk

Error Tracker 的 Browser 和 Node.js SDK。

## 安装

```bash
npm install @error-tracker/sdk
```

SDK 与框架无关，可以在原生 JavaScript、React、Vue、Svelte、Angular 或任何能运行 JavaScript 的环境中使用。React 等框架适配器单独发布，核心 SDK 不依赖具体 UI 框架。

## Browser

```ts
import { init, captureException } from '@error-tracker/sdk'
import { ReplayPlugin } from '@error-tracker/sdk/plugins/replay'

init({
  dsn: 'https://tracker.example.com/ingest/<projectId>',
  token: '<token>',
  environment: 'production',
  release: '1.0.0',
  integrations: [
    new ReplayPlugin({
      bufferSeconds: 30,
      sampleRate: 0.1,
      maskAllText: true,
      blockSelector: '[data-sensitive-block],[data-private],[data-privacy="block"]',
    }),
  ],
})

try {
  throw new Error('checkout failed')
} catch (error) {
  captureException(error as Error)
}
```

浏览器入口会自动捕获运行时错误、未处理 Promise rejection、资源加载失败、breadcrumbs 和 Web Vitals。会话回放由独立入口 `@error-tracker/sdk/plugins/replay` 提供。

SDK 会通过 `x-error-tracker-token` header 发送项目 token。旧格式 `/ingest/<projectId>/<token>` 仍兼容，但新接入建议把 `dsn` 和 `token` 分开传，避免 token 出现在 URL 中。

## 当前 SDK 能力

浏览器 SDK 当前会自动采集：

- JavaScript 运行时错误、未处理 Promise rejection、静态资源加载失败。
- click、keyboard、route、console、`fetch`、`XMLHttpRequest` breadcrumbs。
- HTTP breadcrumb 元数据，包括 method、URL、status、duration、transport 和可用时的 traceId。
- 允许目标请求的 trace propagation headers：`sentry-trace`、`baggage`、`traceparent`。
- Web Vitals、resource timing 和 long task 性能样本。
- 运行环境上下文，包括 browser、OS、device、screen、viewport、network、storage、locale、timezone 和 page visibility。
- 可选会话回放，通过 `@error-tracker/sdk/plugins/replay` 开启。

Node SDK 当前会自动捕获 uncaught exception 和 unhandled promise rejection，并在进程退出前尽力 flush 队列事件。

当前 SDK 不提供独立日志接入 API、后端分布式 tracing span、自定义应用指标、CPU/function profiling、Agent/LLM 监控或自动修复能力。

## 环境上下文

浏览器事件会在 `event.context.environment` 中携带框架无关的环境画像，包括：

- 解析后的 user agent、browser、OS、device class。
- CPU cores、memory、screen、viewport。
- network effective type、RTT、downlink、network quality。
- storage capability、storage quota、usage ratio、persistent storage 状态。
- locale、timezone、page visibility。

如果数据策略需要删除或粗化某些字段，可以使用 `beforeSend`：

```ts
init({
  dsn,
  token,
  beforeSend(event) {
    delete event.context?.environment?.userAgent?.raw
    return event
  },
})
```

## 会话回放隐私

Replay 默认 mask 所有输入和可见文本。敏感区域可以使用这些标记排除：

- `data-sensitive-block`
- `data-private`
- `data-privacy="block"`

也可以通过 `blockSelector` 传入自定义选择器。

## Node.js

```ts
import { init } from '@error-tracker/sdk/node'

init({
  dsn: 'https://tracker.example.com/ingest/<projectId>',
  token: '<token>',
  environment: 'production',
  release: '1.0.0',
})
```

Node.js 入口会捕获 uncaught exception 和 unhandled promise rejection，并在进程退出前尽力 flush 队列事件。

## Package Entries

```text
@error-tracker/sdk                 Browser SDK
@error-tracker/sdk/node            Node.js SDK
@error-tracker/sdk/plugins/replay  rrweb replay plugin
```
