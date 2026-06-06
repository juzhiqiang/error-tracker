# Task P1-01: Monorepo 脚手架

**计划：** Plan 1  
**依赖：** 无  
**可并行：** 否（第一个任务）  
**预计时间：** 10 min

---

## 目标

建立 error-tracker monorepo 的根级配置文件。

## 需要创建的文件

- `error-tracker/package.json`
- `error-tracker/turbo.json`
- `error-tracker/tsconfig.base.json`
- `error-tracker/.gitignore`
- `error-tracker/docker-compose.yml`
- `error-tracker/.env.example`

## 步骤

- [x] **Step 1: 创建 root package.json**

```json
{
  "name": "error-tracker",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "services:up": "docker compose up -d",
    "services:down": "docker compose down",
    "services:reset": "docker compose down -v && docker compose up -d"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  },
  "packageManager": "bun@1.3.13"
}
```

- [x] **Step 2: 创建 turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [x] **Step 3: 创建 tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

- [x] **Step 4: 创建 .gitignore**

```
node_modules/
dist/
.env.local
*.env.local
.turbo/
```

- [x] **Step 5: 创建 docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: error-tracker-pg
    environment:
      POSTGRES_USER: tracker
      POSTGRES_PASSWORD: tracker
      POSTGRES_DB: error_tracker
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    container_name: error-tracker-minio
    command: server /data --console-address ":9002"
    environment:
      MINIO_ROOT_USER: tracker
      MINIO_ROOT_PASSWORD: tracker123
    ports:
      - "9001:9000"
      - "9002:9002"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

- [x] **Step 6: 创建 .env.example**

```env
DATABASE_URL=postgresql://tracker:tracker@localhost:5433/error_tracker
MINIO_ENDPOINT=localhost
MINIO_PORT=9001
MINIO_ACCESS_KEY=tracker
MINIO_SECRET_KEY=tracker123
MINIO_BUCKET=error-tracker
NEXT_PUBLIC_API_URL=http://localhost:3002
BETTER_AUTH_SECRET=change-me-use-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3003
```

- [x] **Step 7: 初始化 git 并提交**

```bash
cd D:/myProject/error-tracker
git add package.json turbo.json tsconfig.base.json .gitignore docker-compose.yml .env.example
git commit -m "feat: monorepo 脚手架"
```
