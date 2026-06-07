# @error-tracker/react

React adapter for Error Tracker SDK.

This package is intentionally separate from `@error-tracker/sdk` so the core SDK remains framework-agnostic and can be used from native JavaScript, Vue, Svelte, Angular, React, or any other runtime without pulling React metadata into the core package.

## Install

```bash
npm install @error-tracker/sdk @error-tracker/react react
```

## Usage

```tsx
import { init } from '@error-tracker/sdk'
import { ErrorBoundary } from '@error-tracker/react'

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
