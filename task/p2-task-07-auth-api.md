# Task P2-07: Better-Auth 登录（API 侧）

**计划：** Plan 2  
**依赖：** Task P2-03, P2-04, P2-05, P2-06（全部完成后才能开始）  
**可并行：** 否  
**预计时间：** 15 min

---

## 目标

集成 Better-Auth，保护所有 `/api/*` 路由。`/ingest/*` 保持公开（DSN Token 鉴权）。

## 需要创建的文件

- `apps/api/src/modules/auth/auth.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/common/guards/session.guard.ts`

## 需要修改的文件

- `apps/api/src/main.ts`（挂载 Better-Auth handler）
- `apps/api/src/modules/issues/issues.controller.ts`（加 SessionGuard）
- `apps/api/src/modules/events/events.controller.ts`（加 SessionGuard）
- `apps/api/src/modules/projects/projects.controller.ts`（加 SessionGuard）
- `apps/api/src/modules/stats/stats.controller.ts`（加 SessionGuard）
- `apps/api/src/modules/sourcemaps/sourcemaps.controller.ts`（加 SessionGuard）

## 步骤

- [ ] **Step 1: 创建 apps/api/src/modules/auth/auth.ts**

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../db/schema'

// 直接创建 db 实例（Better-Auth 需要在模块初始化前就能用）
const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client, { schema })

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3002',
})
```

- [ ] **Step 2: 创建 apps/api/src/modules/auth/auth.module.ts**

```typescript
import { Module } from '@nestjs/common'

@Module({})
export class AuthModule {}
```

- [ ] **Step 3: 创建 apps/api/src/common/guards/session.guard.ts**

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { auth } from '../../modules/auth/auth'

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const session = await auth.api.getSession({ headers: new Headers(req.headers) })
    if (!session) throw new UnauthorizedException()
    req.session = session
    return true
  }
}
```

- [ ] **Step 4: 修改 apps/api/src/main.ts，挂载 Better-Auth handler**

在 `bootstrap()` 函数里，`app.listen()` 之前加入：

```typescript
import { toNodeHandler } from 'better-auth/node'
import { auth } from './modules/auth/auth'

// 在 bootstrap() 里加：
app.use('/api/auth/**', toNodeHandler(auth))
```

完整 main.ts：

```typescript
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './modules/auth/auth'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3003', credentials: true })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  app.use('/api/auth/**', toNodeHandler(auth))
  await app.listen(3002)
  console.log('error-tracker API running on http://localhost:3002')
}
bootstrap()
```

- [ ] **Step 5: 给所有 /api/* controller 加 SessionGuard**

在以下每个 controller 的 class 装饰器上加 `@UseGuards(SessionGuard)`：

`issues.controller.ts`:
```typescript
import { UseGuards } from '@nestjs/common'
import { SessionGuard } from '../../common/guards/session.guard'

@Controller('api/issues')
@UseGuards(SessionGuard)
export class IssuesController { ... }
```

同样处理：`events.controller.ts`、`projects.controller.ts`、`stats.controller.ts`、`sourcemaps.controller.ts`

- [ ] **Step 6: 提交**

```bash
cd D:/myProject/error-tracker
git add apps/api/src/modules/auth/ apps/api/src/common/guards/session.guard.ts \
  apps/api/src/main.ts apps/api/src/modules/issues/issues.controller.ts \
  apps/api/src/modules/events/events.controller.ts \
  apps/api/src/modules/projects/projects.controller.ts \
  apps/api/src/modules/stats/stats.controller.ts \
  apps/api/src/modules/sourcemaps/sourcemaps.controller.ts
git commit -m "feat: Better-Auth 登录（email+password，session guard 保护 API）"
```
