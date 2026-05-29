import { pgTable, text, integer, timestamp, jsonb, serial, uuid, unique } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  dsnToken: text('dsn_token').notNull().unique(),
  webhookUrl: text('webhook_url'),
  alertThreshold: integer('alert_threshold').default(50),
  retentionDays: integer('retention_days').default(30),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const issues = pgTable(
  'issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    fingerprint: text('fingerprint').notNull(),
    title: text('title').notNull(),
    level: text('level', { enum: ['fatal', 'error', 'warning', 'info'] })
      .notNull()
      .default('error'),
    status: text('status', { enum: ['unresolved', 'resolved', 'ignored'] })
      .notNull()
      .default('unresolved'),
    firstSeen: timestamp('first_seen').defaultNow().notNull(),
    lastSeen: timestamp('last_seen').defaultNow().notNull(),
    count: integer('count').default(1).notNull(),
    userCount: integer('user_count').default(1).notNull(),
  },
  (table) => ({
    projectFingerprintUnique: unique('issues_project_fingerprint_unique').on(table.projectId, table.fingerprint),
  }),
)

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  issueId: uuid('issue_id').references(() => issues.id),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  level: text('level').notNull().default('error'),
  message: text('message').notNull(),
  stacktrace: jsonb('stacktrace'),
  breadcrumbs: jsonb('breadcrumbs'),
  request: jsonb('request'),
  user: jsonb('user'),
  tags: jsonb('tags'),
  environment: text('environment'),
  release: text('release'),
})

export const replays = pgTable('replays', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: text('event_id').references(() => events.id),
  storageUrl: text('storage_url').notNull(),
  duration: integer('duration'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const performanceMetrics = pgTable('performance_metrics', {
  id: serial('id').primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name', { enum: ['LCP', 'FID', 'CLS', 'INP', 'TTFB'] }).notNull(),
  value: integer('value').notNull(),
  rating: text('rating', { enum: ['good', 'needs-improvement', 'poor'] }).notNull(),
  url: text('url'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
})

export const sourceMaps = pgTable('source_maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  release: text('release').notNull(),
  filename: text('filename').notNull(),
  storageUrl: text('storage_url').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Better-Auth 表（user/session/account/verification）由 @better-auth/cli 生成
export * from './auth-schema'
