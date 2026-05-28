# Task P1-02: SDK package.json + tsconfig

**计划：** Plan 1  
**依赖：** Task P1-01  
**可并行：** 否  
**预计时间：** 5 min

---

## 目标

配置 `packages/sdk` 的包管理和 TypeScript 编译选项，安装 SDK 依赖。

## 需要创建的文件

- `packages/sdk/package.json`
- `packages/sdk/tsconfig.json`

## 步骤

- [ ] **Step 1: 创建 packages/sdk/package.json**

```json
{
  "name": "@error-tracker/sdk",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "exports": {
    ".": {
      "browser": "./dist/browser/index.js",
      "import": "./dist/browser/index.js",
      "require": "./dist/node/index.cjs"
    },
    "./node": {
      "import": "./dist/node/index.js",
      "require": "./dist/node/index.cjs"
    },
    "./plugins/replay": {
      "browser": "./dist/browser/plugins/replay/index.js",
      "import": "./dist/browser/plugins/replay/index.js"
    }
  },
  "scripts": {
    "build": "bun run build:browser && bun run build:node",
    "build:browser": "bun build src/index.ts --outdir dist/browser --target browser --format esm --sourcemap",
    "build:node": "bun build src/node.ts --outdir dist/node --target node --format cjs --sourcemap",
    "dev": "bun run build --watch",
    "test": "bun test",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "web-vitals": "^4.0.0",
    "rrweb": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  }
}
```

- [ ] **Step 2: 创建 packages/sdk/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: 安装依赖**

```bash
cd D:/myProject/error-tracker
bun install
```

Expected: `node_modules` 创建，`web-vitals` 和 `rrweb` 安装成功

- [ ] **Step 4: 提交**

```bash
git add packages/sdk/package.json packages/sdk/tsconfig.json bun.lockb
git commit -m "feat: sdk package 配置"
```
