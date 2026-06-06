import { pgTable, text, integer, timestamp, jsonb, serial, uuid, unique, index } from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: serial('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    organizationUserUnique: unique('organization_members_org_user_unique').on(table.organizationId, table.userId),
  }),
)

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    teamOrgSlugUnique: unique('teams_org_slug_unique').on(table.organizationId, table.slug),
  }),
)

export const teamMembers = pgTable(
  'team_members',
  {
    id: serial('id').primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    teamUserUnique: unique('team_members_team_user_unique').on(table.teamId, table.userId),
  }),
)

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  dsnToken: text('dsn_token').notNull().unique(),
  webhookUrl: text('webhook_url'),
  alertThreshold: integer('alert_threshold').default(50),
  retentionDays: integer('retention_days').default(30),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projects.id),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const projectMembers = pgTable(
  'project_members',
  {
    id: serial('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectUserUnique: unique('project_members_project_user_unique').on(table.projectId, table.userId),
  }),
)

export const teamProjects = pgTable(
  'team_projects',
  {
    id: serial('id').primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    role: text('role', { enum: ['admin', 'member', 'viewer'] }).notNull().default('viewer'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    teamProjectUnique: unique('team_projects_team_project_unique').on(table.teamId, table.projectId),
  }),
)

export const projectInvitations = pgTable(
  'project_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    email: text('email').notNull(),
    role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull(),
    tokenHash: text('token_hash').notNull(),
    status: text('status', { enum: ['pending', 'accepted', 'revoked', 'expired'] })
      .notNull()
      .default('pending'),
    invitedByUserId: text('invited_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    acceptedByUserId: text('accepted_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tokenHashUnique: unique('project_invitations_token_hash_unique').on(table.tokenHash),
    projectStatusIdx: index('project_invitations_project_status_idx').on(table.projectId, table.status),
  }),
)

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

export const sourceMaps = pgTable(
  'source_maps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    release: text('release').notNull(),
    filename: text('filename').notNull(),
    storageUrl: text('storage_url').notNull(),
    checksum: text('checksum'),
    sizeBytes: integer('size_bytes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectReleaseFilenameUnique: unique('source_maps_project_release_filename_unique').on(
      table.projectId,
      table.release,
      table.filename,
    ),
  }),
)

// Better-Auth 表（user/session/account/verification）由 @better-auth/cli 生成
export * from './auth-schema'
