import { Inject, Injectable, Optional } from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import { sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'
import type { ProjectRole } from '../access/project-roles.decorator'

export type ProjectInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'
export type InvitationAcceptOutcome = 'accepted' | 'not_found' | 'expired' | 'revoked' | 'already_accepted' | 'email_mismatch'

export interface ProjectInvitationRow {
  id: string
  projectId: string
  projectName: string
  email: string
  role: ProjectRole
  status: ProjectInvitationStatus
  invitedByUserId?: string | null
  inviterEmail?: string | null
  acceptedByUserId?: string | null
  expiresAt: Date
  acceptedAt?: Date | null
  revokedAt?: Date | null
  createdAt: Date
}

export interface ProjectInvitationWithToken extends ProjectInvitationRow {
  inviteToken: string
  inviteUrl: string
}

export interface ProjectInvitationsServiceOptions {
  appBaseUrl?: string
  now?: () => Date
  tokenFactory?: () => string
}

export const PROJECT_INVITATIONS_OPTIONS = Symbol('PROJECT_INVITATIONS_OPTIONS')

@Injectable()
export class ProjectInvitationsService {
  private readonly appBaseUrl: string
  private readonly now: () => Date
  private readonly tokenFactory: () => string

  constructor(
    @Inject(DB) private readonly db: PostgresJsDatabase<typeof schema>,
    @Optional()
    @Inject(PROJECT_INVITATIONS_OPTIONS)
    options: ProjectInvitationsServiceOptions = {},
  ) {
    this.appBaseUrl = (options.appBaseUrl ?? process.env.BETTER_AUTH_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:3003').replace(/\/$/, '')
    this.now = options.now ?? (() => new Date())
    this.tokenFactory = options.tokenFactory ?? (() => randomBytes(32).toString('base64url'))
  }

  async list(projectId: string): Promise<ProjectInvitationRow[]> {
    const result = await this.db.execute(sql`
      SELECT
        pi.id,
        pi.project_id as "projectId",
        p.name as "projectName",
        pi.email,
        pi.role,
        CASE
          WHEN pi.status = 'pending' AND pi.expires_at <= now() THEN 'expired'
          ELSE pi.status
        END as status,
        pi.invited_by_user_id as "invitedByUserId",
        inviter.email as "inviterEmail",
        pi.accepted_by_user_id as "acceptedByUserId",
        pi.expires_at as "expiresAt",
        pi.accepted_at as "acceptedAt",
        pi.revoked_at as "revokedAt",
        pi.created_at as "createdAt"
      FROM project_invitations pi
      JOIN projects p ON p.id = pi.project_id
      LEFT JOIN "user" inviter ON inviter.id = pi.invited_by_user_id
      WHERE pi.project_id = ${projectId}
      ORDER BY
        CASE
          WHEN pi.status = 'pending' AND pi.expires_at > now() THEN 1
          WHEN pi.status = 'pending' AND pi.expires_at <= now() THEN 2
          WHEN pi.status = 'revoked' THEN 3
          ELSE 4
        END,
        pi.created_at DESC
    `)
    return rowsFrom<ProjectInvitationRow>(result)
  }

  async create(input: {
    projectId: string
    email: string
    role: ProjectRole
    invitedByUserId?: string | null
  }): Promise<ProjectInvitationWithToken> {
    const email = normalizeEmail(input.email)
    const token = this.tokenFactory()
    const tokenHash = hashToken(token)
    const expiresAt = addDays(this.now(), 7)
    const expiresAtSql = expiresAt.toISOString()

    await this.db.execute(sql`
      UPDATE project_invitations
      SET status = 'revoked', revoked_at = now()
      WHERE project_id = ${input.projectId}
        AND lower(email) = lower(${email})
        AND status = 'pending'
    `)

    const result = await this.db.execute(sql`
      INSERT INTO project_invitations (project_id, email, role, token_hash, status, invited_by_user_id, expires_at)
      VALUES (${input.projectId}, ${email}, ${input.role}, ${tokenHash}, 'pending', ${input.invitedByUserId ?? null}, CAST(${expiresAtSql} AS timestamp))
      RETURNING
        id,
        project_id as "projectId",
        (SELECT name FROM projects WHERE id = project_id) as "projectName",
        email,
        role,
        status,
        invited_by_user_id as "invitedByUserId",
        expires_at as "expiresAt",
        accepted_at as "acceptedAt",
        revoked_at as "revokedAt",
        created_at as "createdAt"
    `)
    return this.withToken(requiredRow<ProjectInvitationRow>(result, 'Invitation could not be created'), token)
  }

  async detail(token: string): Promise<ProjectInvitationRow | null> {
    const invitation = await this.findByToken(token)
    if (!invitation) return null
    return this.isExpired(invitation) ? { ...invitation, status: 'expired' } : invitation
  }

  async accept(
    token: string,
    user: { userId: string; email: string },
  ): Promise<{ outcome: InvitationAcceptOutcome; invitation?: ProjectInvitationRow }> {
    const invitation = await this.findByToken(token)
    if (!invitation) return { outcome: 'not_found' }
    if (invitation.status === 'accepted') return { outcome: 'already_accepted', invitation }
    if (invitation.status === 'revoked') return { outcome: 'revoked', invitation }
    if (invitation.status === 'expired' || this.isExpired(invitation)) {
      await this.markExpired(invitation.id)
      return { outcome: 'expired', invitation: { ...invitation, status: 'expired' } }
    }
    if (normalizeEmail(invitation.email) !== normalizeEmail(user.email)) {
      return { outcome: 'email_mismatch', invitation }
    }

    const result = await this.db.execute(sql`
      WITH accepted AS (
        UPDATE project_invitations
        SET status = 'accepted',
            accepted_at = now(),
            accepted_by_user_id = ${user.userId}
        WHERE id = ${invitation.id}
          AND status = 'pending'
        RETURNING *
      ),
      upserted_member AS (
        INSERT INTO project_members (project_id, user_id, role)
        SELECT project_id, ${user.userId}, role FROM accepted
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
        RETURNING project_id, user_id, role
      )
      SELECT
        accepted.id,
        accepted.project_id as "projectId",
        p.name as "projectName",
        accepted.email,
        accepted.role,
        accepted.status,
        accepted.invited_by_user_id as "invitedByUserId",
        accepted.accepted_by_user_id as "acceptedByUserId",
        accepted.expires_at as "expiresAt",
        accepted.accepted_at as "acceptedAt",
        accepted.revoked_at as "revokedAt",
        accepted.created_at as "createdAt"
      FROM accepted
      JOIN projects p ON p.id = accepted.project_id
      JOIN upserted_member um ON um.project_id = accepted.project_id
    `)
    return { outcome: 'accepted', invitation: requiredRow<ProjectInvitationRow>(result, 'Invitation could not be accepted') }
  }

  async resend(projectId: string, invitationId: string): Promise<ProjectInvitationWithToken | null> {
    const token = this.tokenFactory()
    const tokenHash = hashToken(token)
    const expiresAt = addDays(this.now(), 7)
    const expiresAtSql = expiresAt.toISOString()
    const result = await this.db.execute(sql`
      UPDATE project_invitations
      SET token_hash = ${tokenHash},
          expires_at = CAST(${expiresAtSql} AS timestamp),
          status = 'pending',
          revoked_at = null
      WHERE id = ${invitationId}
        AND project_id = ${projectId}
        AND status IN ('pending', 'expired')
      RETURNING
        id,
        project_id as "projectId",
        (SELECT name FROM projects WHERE id = project_id) as "projectName",
        email,
        role,
        status,
        invited_by_user_id as "invitedByUserId",
        expires_at as "expiresAt",
        accepted_at as "acceptedAt",
        revoked_at as "revokedAt",
        created_at as "createdAt"
    `)
    const row = rowsFrom<ProjectInvitationRow>(result)[0]
    return row ? this.withToken(row, token) : null
  }

  async revoke(projectId: string, invitationId: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE project_invitations
      SET status = 'revoked',
          revoked_at = now()
      WHERE id = ${invitationId}
        AND project_id = ${projectId}
        AND status = 'pending'
      RETURNING id
    `)
    return rowsFrom<{ id: string }>(result).length > 0
  }

  private async findByToken(token: string): Promise<ProjectInvitationRow | null> {
    const result = await this.db.execute(sql`
      SELECT
        pi.id,
        pi.project_id as "projectId",
        p.name as "projectName",
        pi.email,
        pi.role,
        pi.status,
        pi.invited_by_user_id as "invitedByUserId",
        inviter.email as "inviterEmail",
        pi.accepted_by_user_id as "acceptedByUserId",
        pi.expires_at as "expiresAt",
        pi.accepted_at as "acceptedAt",
        pi.revoked_at as "revokedAt",
        pi.created_at as "createdAt"
      FROM project_invitations pi
      JOIN projects p ON p.id = pi.project_id
      LEFT JOIN "user" inviter ON inviter.id = pi.invited_by_user_id
      WHERE pi.token_hash = ${hashToken(token)}
      LIMIT 1
    `)
    return rowsFrom<ProjectInvitationRow>(result)[0] ?? null
  }

  private markExpired(invitationId: string) {
    return this.db.execute(sql`
      UPDATE project_invitations
      SET status = 'expired'
      WHERE id = ${invitationId}
        AND status = 'pending'
    `)
  }

  private isExpired(invitation: ProjectInvitationRow) {
    return new Date(invitation.expiresAt).getTime() <= this.now().getTime()
  }

  private withToken(row: ProjectInvitationRow, inviteToken: string): ProjectInvitationWithToken {
    return { ...row, inviteToken, inviteUrl: `${this.appBaseUrl}/accept-invite/${inviteToken}` }
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function rowsFrom<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] }).rows ?? [])
}

function requiredRow<T>(result: unknown, message: string): T {
  const row = rowsFrom<T>(result)[0]
  if (!row) throw new Error(message)
  return row
}
