# Web Onboarding Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Dashboard friendlier for first Web SDK integration tests without changing backend behavior or target application code.

**Architecture:** Keep the existing dashboard shell, panels, i18n, and SDK docs model. Add Web onboarding copy and compact verification UI to Overview, Settings, Docs, and Issue Detail so users can copy configuration, send a test event, and verify stack/breadcrumb/performance evidence.

**Tech Stack:** Next.js App Router, React client components, Tailwind utility classes, existing `useI18n`, Bun tests.

---

### Task 1: Web Onboarding Copy Tests

**Files:**
- Modify: `apps/web/src/lib/no-runtime-mock-data.test.ts`
- Modify: `apps/web/src/lib/i18n.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions that the Dashboard source exposes Web onboarding terms without fabricated telemetry.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/no-runtime-mock-data.test.ts`
Expected: FAIL because the new Web onboarding copy has not been added.

- [ ] **Step 3: Add i18n strings and page copy**

Add English and Chinese labels for Web setup status, `.env` copy, verification event copy, source map hint, and issue evidence hints.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/no-runtime-mock-data.test.ts`
Expected: PASS.

### Task 2: Settings Web SDK Setup

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Write the failing test**

Extend source-level test coverage to expect `.env` and verification event copy affordances.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/no-runtime-mock-data.test.ts`
Expected: FAIL because Settings does not expose the new copy actions.

- [ ] **Step 3: Implement minimal Settings UI**

Add a compact Web setup panel near the DSN and SDK snippet with copy buttons for env variables, SDK init, and verification event.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/no-runtime-mock-data.test.ts`
Expected: PASS.

### Task 3: Overview and Evidence Layout

**Files:**
- Modify: `apps/web/src/app/(dashboard)/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/issues/[id]/page.tsx`

- [ ] **Step 1: Write the failing test**

Assert Overview contains a Web integration readiness panel and Issue Detail contains source map/release verification copy.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/no-runtime-mock-data.test.ts`
Expected: FAIL because the panels are absent.

- [ ] **Step 3: Implement minimal UI**

Add readiness cards above lower-priority Overview panels. Add an issue detail verification strip for stack, breadcrumbs, release, sourcemap, and performance correlation.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/no-runtime-mock-data.test.ts`
Expected: PASS.

### Task 4: Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run: `bun test apps/web/src/lib/no-runtime-mock-data.test.ts apps/web/src/lib/i18n.test.ts apps/web/src/lib/welcome-tour.test.ts`

- [ ] **Step 2: Run Web typecheck**

Run: `bun run --cwd apps/web lint`

- [ ] **Step 3: Run Web production build**

Run: `bun run --cwd apps/web build`
