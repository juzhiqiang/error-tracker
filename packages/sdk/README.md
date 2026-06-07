# @error-tracker/sdk

Browser and Node.js SDK for Error Tracker.

## Install

```bash
npm install @error-tracker/sdk
```

The SDK is framework-agnostic and can be used from native JavaScript, React, Vue, Svelte, Angular, or any other runtime that can call JavaScript. Framework adapters are published separately so this core package never depends on React, Vue, or other UI frameworks.

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

The browser entry captures errors, unhandled rejections, breadcrumbs, and Web Vitals. Replay support is provided by the separate `@error-tracker/sdk/plugins/replay` subpath.

The SDK sends the project token in the `x-error-tracker-token` header. Legacy DSNs shaped as `/ingest/<projectId>/<token>` are still accepted for compatibility, but new installs should pass `dsn` and `token` separately so the token is not placed in request URLs.

Browser events also include a framework-agnostic environment profile under `event.context.environment`: parsed user agent, browser and OS, device class, CPU cores, memory, screen and viewport, network effective type, RTT, downlink, network quality, storage capability, storage quota and usage ratio, persistent storage status, locale, timezone, and page visibility. Use `beforeSend` if your data policy needs to remove or coarsen any field before upload.

Replay masks all inputs and visible text by default. Mark sensitive regions that should be removed from replay with `data-sensitive-block`, `data-private`, or `data-privacy="block"`, or pass a custom `blockSelector`.

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

The Node.js entry captures uncaught exceptions and unhandled promise rejections, then flushes queued events before process exit when possible.

## Package Entries

```text
@error-tracker/sdk                 Browser SDK
@error-tracker/sdk/node            Node.js SDK
@error-tracker/sdk/plugins/replay  rrweb replay plugin
```
