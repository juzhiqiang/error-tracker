# Task P2-01: API 依赖 + 基础结构

**计划：** Plan 2  
**依赖：** Plan 1 全部完成  
**可并行：** 否（Plan 2 第一个任务）  
**预计时间：** 10 min

---

## 目标

创建 `apps/api` 的 package.json、tsconfig、main.ts，安装 NestJS 依赖。

## 需要创建的文件

- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/src/main.ts`

## 步骤

- [ ] **Step 1: 创建 apps/api/package.json**

```json
{
  "name": "@error-tracker/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "test": "bun test",
    "lint": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/bull": "^10.0.0",
    "bullmq": "^5.0.0",
    "drizzle-orm": "^0.45.0",
    "postgres": "^3.4.0",
    "drizzle-kit": "^0.30.0",
    "better-auth": "^1.4.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "source-map": "^0.7.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/source-map": "^0.5.0",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: 创建 apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "target": "ES2022",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 创建 apps/api/src/main.ts**

```typescript
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3003' })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  await app.listen(3002)
  console.log('error-tracker API running on http://localhost:3002')
}
bootstrap()
```

- [ ] **Step 4: 安装依赖**

```bash
cd D:/myProject/error-tracker && bun install
```

Expected: NestJS 相关包安装成功

- [ ] **Step 5: 提交**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/src/main.ts
git commit -m "feat: api app 基础结构"
```
