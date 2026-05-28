# Task P2-09: Next.js Dashboard 基础结构

**计划：** Plan 2  
**依赖：** Task P2-02（可与 Task P2-03~06 并行开始）  
**可并行：** 是（可在批次 3 与 P2-03~06 并行执行）  
**预计时间：** 10 min

---

## 目标

创建 `apps/web` 的 package.json、tsconfig、next.config.ts，安装 Next.js 依赖，初始化 shadcn/ui。

## 需要创建的文件

- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next.config.ts`

## 步骤

- [ ] **Step 1: 创建 apps/web/package.json**

```json
{
  "name": "@error-tracker/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3003",
    "build": "next build",
    "start": "next start -p 3003",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "better-auth": "^1.4.0",
    "@error-tracker/sdk": "workspace:*",
    "recharts": "^2.0.0",
    "rrweb-player": "^2.0.0",
    "@radix-ui/react-dialog": "^1.0.0",
    "@radix-ui/react-select": "^2.0.0",
    "sonner": "^1.0.0",
    "clsx": "^2.0.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/react": "^18.0.0",
    "@types/node": "^22.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0"
  }
}
```

- [ ] **Step 2: 创建 apps/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 创建 apps/web/next.config.ts**

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@error-tracker/sdk'],
}
export default config
```

- [ ] **Step 4: 创建 tailwind.config.ts**

```typescript
// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        surface: '#1e293b',
        'surface-2': '#334155',
        primary: '#6366f1',
        'primary-hover': '#4f46e5',
        danger: '#ef4444',
        success: '#22c55e',
        warning: '#f59e0b',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 5: 创建 src/app/globals.css**

```css
/* apps/web/src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --background: #0f172a;
  --surface: #1e293b;
}

body {
  background-color: var(--background);
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
}
```

- [ ] **Step 6: 创建 src/lib/auth-client.ts**

```typescript
// apps/web/src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002',
})
```

- [ ] **Step 7: 安装依赖**

```bash
cd D:/myProject/error-tracker && bun install
```

- [ ] **Step 8: 提交**

```bash
git add apps/web/
git commit -m "feat: web app 基础结构（Next.js 14 + TailwindCSS dark theme）"
```
