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
  dsn: 'https://tracker.example.com/ingest/<projectId>/<token>',
  environment: 'production',
  release: '1.0.0',
  integrations: [new ReplayPlugin({ bufferSeconds: 30, sampleRate: 0.1 })],
})

try {
  throw new Error('checkout failed')
} catch (error) {
  captureException(error as Error)
}
```

The browser entry captures errors, unhandled rejections, breadcrumbs, and Web Vitals. Replay support is provided by the separate `@error-tracker/sdk/plugins/replay` subpath.

## Node.js

```ts
import { init } from '@error-tracker/sdk/node'

init({
  dsn: 'https://tracker.example.com/ingest/<projectId>/<token>',
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
