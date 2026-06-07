# @error-tracker/sdk

Browser and Node.js SDK for Error Tracker.

## Install

```bash
npm install @error-tracker/sdk
```

The core browser and Node.js entries do not depend on React. React is only needed when you import the optional `@error-tracker/sdk/react` entry.

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

## React Error Boundary

React support is intentionally isolated so non-React browser and Node consumers do not need to install React.
Install React in the host application before using this optional entry.

```tsx
import { init } from '@error-tracker/sdk'
import { ErrorBoundary } from '@error-tracker/sdk/react'

const client = init({
  dsn: 'https://tracker.example.com/ingest/<projectId>/<token>',
})

export function App() {
  return (
    <ErrorBoundary client={client} fallback={<div>Something went wrong.</div>}>
      <Routes />
    </ErrorBoundary>
  )
}
```

## Package Entries

```text
@error-tracker/sdk                 Browser SDK
@error-tracker/sdk/node            Node.js SDK
@error-tracker/sdk/react           React ErrorBoundary
@error-tracker/sdk/plugins/replay  rrweb replay plugin
```
