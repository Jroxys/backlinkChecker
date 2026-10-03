import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { ApiError, body, notFound, ownerOnly, requireUser, router, type C } from '../http.js'
import { sha256 } from '../lib/auth.js'
import { id } from '../lib/ids.js'
import { getPlan } from '../plans.js'
import { track } from '../services/events.js'

const INVITE_DAYS = 7

/**
 * Seats. The owner's account is the workspace: members see and edit its projects under the
 * owner's plan. Billing, Google, branding and the team itself stay with the owner.
 */
export const teamRoutes = router()

const seatsUsed = (c: C, ownerId: string) =>
  1 +
  c.var.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM team_members WHERE owner_id = ?', [ownerId])!.n +
  c.var.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM team_invites WHERE owner_id = ? AND expires_at > ?', [ownerId, c.var.ctx.now().toISOString()])!.n

function inviteByToken(c: C, token: string | undefined) {
  if (!token) return null
  return (
    c.var.ctx.db.get<{ id: string; owner_id: string; email: string; expires_at: string; owner_name: string; owner_plan: string }>(
      'SELECT i.*, u.name AS owner_name, u.plan AS owner_plan FROM team_invites i JOIN users u ON u.id = i.owner_id WHERE i.token_hash = ?',
      [sha256(token)],
    ) ?? null
  )
}

/** Public: lets the invite page say whose team this is before the person signs in. */
teamRoutes.get('/invite', (c) => {
  const inv = inviteByToken(c, c.req.query('token'))
  if (!inv) throw notFound('Invite')
  return c.json({ ownerName: inv.owner_name, email: inv.email, expired: inv.expires_at < c.var.ctx.now().toISOString() })
})

teamRoutes.use('/', requireUser)
teamRoutes.use('/invites/*', requireUser, ownerOnly)
teamRoutes.use('/invites', requireUser, ownerOnly)
teamRoutes.use('/members/*', requireUser, ownerOnly)
teamRoutes.use('/join', requireUser)
teamRoutes.use('/leave', requireUser)

teamRoutes.get('/', (c) => {
  const { db } = c.var.ctx
  const ownerId = c.var.account.id
  const owner = db.get<{ id: string; name: string; email: string; created_at: string }>('SELECT id, name, email, created_at FROM users WHERE id = ?', [ownerId])!
  const members = db.all<{ id: string; name: string; email: string; joined: string }>(
    'SELECT u.id, u.name, u.email, t.created_at AS joined FROM team_members t JOIN users u ON u.id = t.member_id WHERE t.owner_id = ? ORDER BY t.created_at',
    [ownerId],
  )
  const isOwner = c.var.account.role === 'owner'
  const invites = isOwner
    ? db.all<{ id: string; email: string; created_at: string; expires_at: string }>('SELECT id, email, created_at, expires_at FROM team_invites WHERE owner_id = ? ORDER BY created_at DESC', [ownerId])
    : []
  return c.json({
    role: c.var.account.role,
    seats: { used: seatsUsed(c, ownerId), limit: getPlan(c.var.account.plan).limits.seats },
    owner: { id: owner.id, name: owner.name, email: owner.email },
    members: members.map((m) => ({ id: m.id, name: m.name, email: m.email, joinedAt: m.joined })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, createdAt: i.created_at, expiresAt: i.expires_at, expired: i.expires_at < c.var.ctx.now().toISOString() })),
  })
})

teamRoutes.post('/invites', async (c) => {
  const { db, config, notifier } = c.var.ctx
  const { email } = await body(c, z.object({ email: z.string().trim().toLowerCase().email() }))
  const ownerId = c.var.account.id
  const limit = getPlan(c.var.account.plan).limits.seats
  if (limit <= 1) throw new ApiError(402, 'plan_feature', 'Team seats are available from the Pro plan')
  if (email === c.var.user.email.toLowerCase()) throw new ApiError(409, 'invalid', 'That’s you')
  if (db.get('SELECT 1 FROM team_members t JOIN users u ON u.id = t.member_id WHERE t.owner_id = ? AND u.email = ?', [ownerId, email])) throw new ApiError(409, 'duplicate', `${email} is already on your team`)
  // Re-inviting the same email replaces the old invite (fresh link, fresh expiry) instead of using another seat.
  const existing = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM team_invites WHERE owner_id = ? AND email = ? AND expires_at > ?', [ownerId, email, c.var.ctx.now().toISOString()])!.n
  if (seatsUsed(c, ownerId) - existing >= limit) throw new ApiError(402, 'plan_limit', `Your plan includes ${limit} seats. Remove a member or upgrade for more.`)
  db.run('DELETE FROM team_invites WHERE owner_id = ? AND email = ?', [ownerId, email])
  const token = randomBytes(24).toString('base64url')
  const inviteId = id('inv')
  const nowIso = c.var.ctx.now().toISOString()
  db.run('INSERT INTO team_invites (id, owner_id, email, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', [
    inviteId,
    ownerId,
    email,
    sha256(token),
    nowIso,
    new Date(c.var.ctx.now().getTime() + INVITE_DAYS * 86_400_000).toISOString(),
  ])
  await notifier.email(
    email,
    `${c.var.user.name} invited you to Indexora`,
    `${c.var.user.name} (${c.var.user.email}) invited you to their Indexora workspace, where they monitor indexing and backlinks for their sites.\n\n` +
      `Accept the invite:\n${config.appUrl}/join?token=${token}\n\nThe link works for ${INVITE_DAYS} days. If you weren’t expecting this, you can ignore it.`,
  )
  track(db, 'team_invite_sent', c.var.user.id)
  return c.json({ invite: { id: inviteId, email } }, 201)
})

teamRoutes.delete('/invites/:id', (c) => {
  const r = c.var.ctx.db.run('DELETE FROM team_invites WHERE id = ? AND owner_id = ?', [c.req.param('id'), c.var.account.id])
  if (!r.changes) throw notFound('Invite')
  return c.body(null, 204)
})

teamRoutes.delete('/members/:id', (c) => {
  const r = c.var.ctx.db.run('DELETE FROM team_members WHERE member_id = ? AND owner_id = ?', [c.req.param('id'), c.var.account.id])
  if (!r.changes) throw notFound('Member')
  return c.body(null, 204)
})

teamRoutes.post('/join', async (c) => {
  const { db } = c.var.ctx
  const { token } = await body(c, z.object({ token: z.string().min(10).max(200) }))
  const inv = inviteByToken(c, token)
  if (!inv || inv.expires_at < c.var.ctx.now().toISOString()) throw new ApiError(404, 'invite_invalid', 'This invite link is invalid or has expired. Ask for a new one.')
  const me = c.var.user
  if (inv.email !== me.email.toLowerCase()) throw new ApiError(403, 'wrong_account', `This invite is for ${inv.email}. Sign in with that email to accept it.`)
  if (c.var.account.role === 'member') throw new ApiError(409, 'already_member', `You’re already on ${c.var.account.ownerName}’s team. Leave it first.`)
  if (db.get('SELECT 1 FROM team_members WHERE owner_id = ? UNION SELECT 1 FROM team_invites WHERE owner_id = ?', [me.id, me.id])) throw new ApiError(409, 'has_team', 'You have your own team or pending invites. Remove them before joining another team.')
  if (db.get('SELECT 1 FROM projects WHERE user_id = ?', [me.id]))
    throw new ApiError(409, 'has_projects', 'Your account has its own projects. Delete them first, or accept with a different account — members work inside the team’s projects.')
  db.tx(() => {
    db.run('INSERT INTO team_members (member_id, owner_id, created_at) VALUES (?, ?, ?)', [me.id, inv.owner_id, c.var.ctx.now().toISOString()])
    db.run('DELETE FROM team_invites WHERE id = ?', [inv.id])
  })
  track(db, 'team_joined', me.id)
  return c.json({ ok: true, ownerName: inv.owner_name })
})

teamRoutes.post('/leave', (c) => {
  const r = c.var.ctx.db.run('DELETE FROM team_members WHERE member_id = ?', [c.var.user.id])
  if (!r.changes) throw new ApiError(409, 'not_member', 'You’re not on a team')
  return c.body(null, 204)
})
