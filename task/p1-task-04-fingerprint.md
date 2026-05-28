# Task P1-04: Fingerprint 指纹计算

**计划：** Plan 1  
**依赖：** Task P1-02（Task P1-03 需同步完成，因为引用 types.ts）  
**可并行：** 是（与 Task 3, 5, 6, 7 并行，但需要 types.ts 存在）  
**预计时间：** 10 min

---

## 目标

实现客户端错误指纹计算。指纹用于 SDK 端 5s 去重，不含行列号（防止不同构建版本产生不同指纹）。

## 需要创建的文件

- `packages/sdk/src/core/fingerprint.ts`
- `packages/sdk/src/__tests__/fingerprint.test.ts`

## 步骤

- [ ] **Step 1: 写测试**

```typescript
// packages/sdk/src/__tests__/fingerprint.test.ts
import { describe, it, expect } from 'bun:test'
import { clientFingerprint, parseStackFrames } from '../core/fingerprint'

describe('clientFingerprint', () => {
  it('same error produces same fingerprint', () => {
    const error = new Error('Cannot read properties of undefined')
    const fp1 = clientFingerprint(error)
    const fp2 = clientFingerprint(error)
    expect(fp1).toBe(fp2)
  })

  it('different messages produce different fingerprints', () => {
    const e1 = new Error('error one')
    const e2 = new Error('error two')
    expect(clientFingerprint(e1)).not.toBe(clientFingerprint(e2))
  })

  it('returns hex string of length 8', () => {
    const fp = clientFingerprint(new Error('test'))
    expect(fp).toMatch(/^[0-9a-f]{8}$/)
  })

  it('ignores line/column numbers - same function at different lines same fingerprint', () => {
    const e1 = new Error('test')
    e1.stack = `Error: test\n    at handleSubmit (main.abc.js:87:12)\n    at onClick (app.js:34:5)`
    const e2 = new Error('test')
    e2.stack = `Error: test\n    at handleSubmit (main.xyz.js:99:45)\n    at onClick (app.js:60:3)`
    expect(clientFingerprint(e1)).toBe(clientFingerprint(e2))
  })
})

describe('parseStackFrames', () => {
  it('parses V8 stack trace', () => {
    const stack = `Error: test\n    at handleSubmit (src/Form.tsx:87:12)\n    at onClick (src/App.tsx:34:5)`
    const frames = parseStackFrames(stack)
    expect(frames[0]).toEqual({ function: 'handleSubmit', filename: 'src/Form.tsx', lineno: 87, colno: 12 })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd D:/myProject/error-tracker
bun test packages/sdk/src/__tests__/fingerprint.test.ts
```

Expected: FAIL - "Cannot find module '../core/fingerprint'"

- [ ] **Step 3: 创建 packages/sdk/src/core/fingerprint.ts**

```typescript
import type { StackFrame } from '../types'

export function parseStackFrames(stack: string): StackFrame[] {
  const lines = stack.split('\n').slice(1)  // 跳过第一行 "Error: message"
  return lines.slice(0, 10).map(line => {
    // V8格式: "    at functionName (filename:line:col)"
    // 或:     "    at filename:line:col"
    const match = line.trim().match(/^at (?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/)
    if (!match) return { function: '<unknown>', filename: '<unknown>' }
    return {
      function: match[1] ?? '<anonymous>',
      filename: match[2],
      lineno: parseInt(match[3], 10),
      colno: parseInt(match[4], 10),
    }
  }).filter(f => f.filename !== '<unknown>')
}

// djb2 hash → 8 char hex
function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0  // 保持 uint32
  }
  return hash.toString(16).padStart(8, '0')
}

export function clientFingerprint(error: Error): string {
  const frames = parseStackFrames(error.stack ?? '')
  // 只用文件名（不含路径 hash），去掉行列号，防止不同构建版本指纹不同
  const frameKey = frames.slice(0, 3)
    .map(f => `${f.function}@${f.filename.replace(/:[^:]*$/, '')}`)
    .join('|')
  return djb2(`${error.name}:${error.message}:${frameKey}`)
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/fingerprint.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/sdk/src/core/fingerprint.ts packages/sdk/src/__tests__/fingerprint.test.ts
git commit -m "feat: sdk 指纹计算（djb2，忽略行列号）"
```
