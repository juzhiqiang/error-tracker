import { pgTable, text, integer, timestamp, jsonb, serial, uuid, unique, index, boolean } from 'drizzle-orm/pg-core'
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
  alertUserThreshold: integer('alert_user_threshold').default(10),
  retentionDays: integer('retention_days').default(30),
  aiAnalysisEnabled: boolean('ai_analysis_enabled').default(false).notNull(),
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
    userCount: integer('user_count').default(0).notNull(),
    assigneeUserId: text('assignee_user_id').references(() => user.id, { onDelete: 'set null' }),
    assignedAt: timestamp('assigned_at'),
    assignedByUserId: text('assigned_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at'),
    resolvedByUserId: text('resolved_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    fixedInRelease: text('fixed_in_release'),
    regressedAt: timestamp('regressed_at'),
    regressedInRelease: text('regressed_in_release'),
    mergedIntoIssueId: uuid('merged_into_issue_id'),
    splitFromIssueId: uuid('split_from_issue_id'),
  },
  (table) => ({
    projectFingerprintUnique: unique('issues_project_fingerprint_unique').on(table.projectId, table.fingerprint),
  }),
)

export const issueUsers = pgTable(
  'issue_users',
  {
    id: serial('id').primaryKey(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    userHash: text('user_hash').notNull(),
    firstSeen: timestamp('first_seen').defaultNow().notNull(),
  },
  (table) => ({
    issueUserUnique: unique('issue_users_issue_user_unique').on(table.issueId, table.userHash),
    issueIdIdx: index('issue_users_issue_id_idx').on(table.issueId),
  }),
)

export const issueComments = pgTable(
  'issue_comments',
  {
    id: serial('id').primaryKey(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id').references(() => user.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    issueCreatedIdx: index('issue_comments_issue_created_idx').on(table.issueId, table.createdAt),
  }),
)

export const events = pgTable(
  'events',
  {
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
    context: jsonb('context'),
    environment: text('environment'),
    release: text('release'),
  },
  (table) => ({
    issueIdIdx: index('events_issue_id_idx').on(table.issueId),
    projectTimestampIdx: index('events_project_timestamp_idx').on(table.projectId, table.timestamp),
  }),
)

export const replays = pgTable('replays', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: text('event_id').references(() => events.id),
  storageUrl: text('storage_url').notNull(),
  duration: integer('duration'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const performanceMetrics = pgTable(
  'performance_metrics',
  {
    id: serial('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    kind: text('kind', { enum: ['web-vital', 'resource', 'http', 'longtask'] })
      .notNull()
      .default('web-vital'),
    name: text('name').notNull(),
    value: integer('value').notNull(),
    rating: text('rating', { enum: ['good', 'needs-improvement', 'poor'] }),
    url: text('url'),
    method: text('method'),
    status: integer('status'),
    duration: integer('duration'),
    initiatorType: text('initiator_type'),
    traceId: text('trace_id'),
    metadata: jsonb('metadata'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    projectKindTimestampIdx: index('performance_metrics_project_kind_timestamp_idx').on(
      table.projectId,
      table.kind,
      table.timestamp,
    ),
    projectNameTimestampIdx: index('performance_metrics_project_name_timestamp_idx').on(
      table.projectId,
      table.name,
      table.timestamp,
    ),
  }),
)

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
