# Error Tracker Observability Pipeline Design

Date: 2026-06-17
Status: Approved for planning

## Goal

Upgrade Error Tracker from basic error capture plus Web Vitals into a fuller browser observability pipeline. The change adds missing SDK collection for XHR, route mutations, console levels, keyboard breadcrumbs, trace headers, resource timing, and long tasks, then stores and visualizes those signals in the API and dashboard.

This design keeps the current product shape: a self-hosted Sentry-like platform with browser and Node SDKs, NestJS ingest API, PostgreSQL storage, and a dark professional Next.js dashboard.

## Scope

In scope:

- Browser SDK captures `fetch`, `XMLHttpRequest`, route transitions, click and keyboard interactions, full console breadcrumbs, Web Vitals, long tasks, and resource timing.
- Browser SDK injects distributed tracing headers into same-origin and explicitly allowed outgoing requests.
- API accepts expanded performance events and persists them for query and aggregation.
- Dashboard `/performance` shows Core Web Vitals, network timing, resource timing, and long task panels.
- Issue detail pages surface richer SDK signals: trace id, route breadcrumbs, HTTP breadcrumbs, console breadcrumbs, and user interaction breadcrumbs.
- Tests cover SDK behavior, ingest validation/service behavior, and dashboard data adaptation.

Out of scope for this pass:

- Backend span propagation or OpenTelemetry integration inside `apps/api`.
- Cross-service trace search.
- Replay UX redesign beyond continuing to associate replay clips with error events.
- Recording typed input values. Keyboard breadcrumbs must not capture input contents.

## SDK Design

### Integration Boundaries

The current `BrowserBreadcrumbsIntegration` does too much. It should be split or internally organized into focused helpers while preserving the public integration name for compatibility:

- DOM breadcrumbs: click and keyboard events.
- Navigation breadcrumbs: `pushState`, `replaceState`, `popstate`, and `hashchange`.
- Console breadcrumbs: `log`, `info`, `debug`, `warn`, and `error`.
- HTTP instrumentation: `fetch` and `XMLHttpRequest`.

The existing `BrowserPerformanceIntegration` remains responsible for Web Vitals and gains PerformanceObserver-based collection for resource timing and long tasks.

### HTTP Instrumentation

For `fetch`:

- Preserve the original function and restore it on teardown.
- Measure duration from call start until response or thrown error.
- Add a breadcrumb with `type: 'http'` and data including `url`, `method`, `status`, `duration`, `transport: 'fetch'`, and `traceId`.
- Capture failed requests as breadcrumbs, not exceptions, unless application code throws separately.
- Inject trace headers when allowed by SDK options.

For `XMLHttpRequest`:

- Patch `open`, `send`, and `setRequestHeader` carefully.
- Track method, URL, start time, completion status, and error/abort/timeout states.
- Add the same `http` breadcrumb shape with `transport: 'xhr'`.
- Inject trace headers before `send` when allowed.
- Restore original prototype methods on teardown.

### Trace Headers

Add SDK options:

```ts
tracing?: {
  enabled?: boolean
  tracePropagationTargets?: Array<string | RegExp>
}
```

Defaults:

- `enabled: true`.
- Propagate only to same-origin URLs by default.
- Users can add external API domains through `tracePropagationTargets`.

Headers:

- `sentry-trace`: `<traceId>-<spanId>-1`
- `baggage`: `sentry-trace_id=<traceId>,sentry-sample_rate=<sampleRate>`
- `traceparent`: `00-<traceId>-<spanId>-01`

Trace ids are 32 lowercase hex characters. Span ids are 16 lowercase hex characters.

If a request already has one of these headers, the SDK must not overwrite it.

### DOM Breadcrumbs

Click breadcrumbs remain, but target descriptions should be more useful and bounded:

- Prefer `tag#id`, then selected classes, then ARIA label, then text preview.
- Limit text preview to 64 characters.

Keyboard breadcrumbs:

- Listen to `keydown` or `keypress` at document capture phase.
- Record only event type and target descriptor.
- Do not record `event.key`, input values, textarea values, contenteditable contents, or form field names that look sensitive.
- Coalesce repeated keyboard breadcrumbs from the same target within a short window to avoid flooding.

### Navigation Breadcrumbs

Patch:

- `history.pushState`
- `history.replaceState`

Also listen to:

- `popstate`
- `hashchange`

Breadcrumb data:

- `from`
- `to`
- `source`: `pushState`, `replaceState`, `popstate`, or `hashchange`

### Console Breadcrumbs

Patch:

- `console.log`
- `console.info`
- `console.debug`
- `console.warn`
- `console.error`

Breadcrumb data:

- `level`
- stringified message capped at 256 characters

The original console method must still be called with original arguments.

### PerformanceObserver Events

Extend `PerformanceEvent` to support:

```ts
type PerformanceEvent =
  | WebVitalEvent
  | ResourceTimingEvent
  | LongTaskEvent
```

Resource timing event fields:

- `type: 'performance'`
- `kind: 'resource'`
- `name: 'resource'`
- `url`
- `initiatorType`
- `value`: duration in milliseconds
- `duration`
- `transferSize`
- `encodedBodySize`
- `decodedBodySize`
- `traceId` if associated with an instrumented request

Long task event fields:

- `type: 'performance'`
- `kind: 'longtask'`
- `name: 'longtask'`
- `value`: duration in milliseconds
- `duration`
- `startTime`

Web Vitals keep their current shape, with `kind: 'web-vital'` added for storage and dashboard grouping.

PerformanceObserver availability must be checked before use. Unsupported browsers should continue without errors.

## API And Storage Design

### Schema

Extend `performance_metrics` rather than creating separate tables, because the current dashboard already aggregates from this table and all new data is time-series performance telemetry.

New or widened fields:

- `kind`: `web-vital | resource | http | longtask`
- `name`: text, no longer limited to only Web Vital names.
- `value`: integer milliseconds or metric value.
- `rating`: nullable text.
- `url`: nullable text.
- `method`: nullable text.
- `status`: nullable integer.
- `duration`: nullable integer.
- `initiator_type`: nullable text.
- `trace_id`: nullable text.
- `metadata`: JSONB for future-compatible payload details.

Existing Web Vital rows should continue to work. Migration should default existing rows to `kind = 'web-vital'`.

### Ingest Validation

Validation must accept:

- Existing Web Vital events.
- Resource timing events.
- HTTP timing events from SDK instrumentation if emitted as performance data.
- Long task events.

Validation should still reject:

- Missing `eventId`, `timestamp`, `type`, `kind`, `name`, or finite numeric `value`.
- Invalid ratings for Web Vitals.
- Oversized event batches.

### Ingest Service

`ingestPerformance` should map each kind into `performance_metrics` without creating issues. Error events still flow through issue aggregation.

PII scrubbing applies to URLs and metadata where practical. URLs should retain origin/path/query shape only if current scrubber allows sensitive values to be filtered.

## Dashboard Design

The dashboard keeps the existing dark professional visual language from `AGENTS.md`: slate background, indigo primary, red errors, green success, compact operational layout, Recharts charts, and skeleton loading.

### `/performance`

Add three sections:

1. Core Web Vitals
   - Existing distribution remains.
   - Uses `kind = 'web-vital'`.

2. Network And Resources
   - Cards for total requests/resources, average duration, slowest duration, and error status count.
   - Table of slow requests/resources with URL, method/initiator, status, duration, and trace id.
   - Bar or stacked distribution by status class and initiator type.

3. Main Thread
   - Cards for long task count, total blocked time approximation, longest task, and average duration.
   - Recent long task list or compact chart.

### Issue Detail SDK Signals

Enhance the existing SDK Signals area:

- Trace id and release/environment summary when present.
- HTTP breadcrumbs grouped by fetch/XHR.
- Console breadcrumbs grouped by level.
- Route breadcrumbs as a short timeline.
- Interaction breadcrumbs for click and keyboard events.

The UI must not rely only on color for severity. Use icons and text labels for state.

## Data Flow

1. Browser SDK initializes default integrations.
2. User interacts with the app. SDK records DOM, route, console, and HTTP breadcrumbs.
3. SDK captures Web Vitals, resource timing, and long tasks as performance events.
4. SDK sends events through the existing queue and transport.
5. API validates batches and separates error events from performance events.
6. Error events are grouped into issues and stored with breadcrumbs.
7. Performance events are stored in `performance_metrics`.
8. Dashboard queries stats endpoints and renders Web Vitals, network/resource, and long task views.

## Testing Strategy

SDK tests with `bun test`:

- `fetch` adds breadcrumbs and preserves original behavior.
- `fetch` injects trace headers only for allowed targets and does not overwrite existing headers.
- `XMLHttpRequest` adds breadcrumbs for success, error, timeout, and abort.
- `XMLHttpRequest` injects trace headers for allowed targets.
- `pushState` and `replaceState` create navigation breadcrumbs.
- `popstate` and `hashchange` continue to work.
- All five console levels create breadcrumbs and call originals.
- Keyboard breadcrumbs do not record key values or input contents.
- PerformanceObserver resource entries produce resource performance events.
- PerformanceObserver longtask entries produce long task performance events.
- Teardown restores patched browser APIs.

API tests:

- Validation accepts Web Vital, resource, HTTP, and long task performance events.
- Validation rejects malformed performance events.
- Ingest service stores new performance fields correctly.
- Existing error ingest behavior remains unchanged.

Web tests:

- API client parses expanded performance summaries.
- `/performance` handles empty, loading, web-vital, network/resource, and long task states.
- Issue detail renders new SDK signal groups when breadcrumbs/tags are present.

## Migration And Compatibility

- Existing SDK users keep working with no option changes.
- Replay plugin remains opt-in through `@error-tracker/sdk/plugins/replay`.
- Existing performance rows migrate to `kind = 'web-vital'`.
- Existing stats endpoints may be extended without removing old response fields.
- If browser APIs are unavailable, integrations skip unsupported features silently.

## Rollout

1. Add failing SDK tests for missing browser instrumentation.
2. Implement SDK instrumentation and event types.
3. Add API validation and schema migration tests.
4. Implement schema migration and ingest persistence.
5. Extend stats API response for network/resource and long task summaries.
6. Update `/performance` and issue detail displays.
7. Run package and app tests.

## Verification

Minimum verification before completion:

- `bun test packages/sdk`
- API ingest validation/service tests.
- Web API/page tests touched by the change.
- `cd packages/sdk && bun run build`
- Manual browser smoke test if the dev stack can run: send fetch/XHR, trigger route changes, log console output, create a long task, then confirm dashboard display.
