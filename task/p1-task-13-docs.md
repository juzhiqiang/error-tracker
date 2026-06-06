# Task P1-13: 同步更新设计文档

**计划：** Plan 1  
**依赖：** Task P1-12  
**可并行：** 否  
**预计时间：** 5 min

---

## 目标

在设计文档中补充两层去重的完整描述，与代码实现对齐。

## 需要修改的文件

- `docs/superpowers/specs/2026-05-27-error-tracker-design.md`

## 步骤

- [x] **Step 1: 在设计文档"去重 & 限流"章节补充两层去重描述**

在 `docs/superpowers/specs/2026-05-27-error-tracker-design.md` 的"去重 & 限流"章节，将原有内容替换为：

```markdown
### 去重 & 限流

**两层去重：**

**Layer 1 — SDK 端（防客户端刷屏）**

内存 Map TTL，相同指纹 5s 内只上报一次：

```typescript
// SDK 端指纹：djb2(error.name + error.message + 前3帧 function@filename)，不含行列号
// 5s TTL，相同指纹直接丢弃，不发请求
```

**Layer 2 — 服务端聚合（跨用户、跨构建版本合并为同一 Issue）**

服务端指纹不含行列号，使同一 bug 在不同构建版本下指纹一致：

```typescript
serverFingerprint = sha1(level + message + 前3帧 function@filename（只取文件名）)
```

UPSERT 时已解决的 issue 若再次出现自动重新打开：

```sql
INSERT INTO issues (project_id, fingerprint, title, ...)
ON CONFLICT (project_id, fingerprint) DO UPDATE SET
  last_seen = now(),
  count = issues.count + 1,
  status = CASE WHEN issues.status = 'resolved' THEN 'unresolved' ELSE issues.status END
```

**其他限流：**
- 队列满（50 条）时丢弃最旧事件（非阻塞）
- `visibilitychange` 切后台时立即 flush 队列（比 beforeunload 更可靠）
```

- [x] **Step 2: 提交**

```bash
cd D:/myProject/error-tracker
git add docs/
git commit -m "docs: 同步 SDK 实现细节到设计文档（两层去重）"
```
