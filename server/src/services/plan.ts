import type { Ctx } from '../context.js'
import { getPlan } from '../plans.js'
import { track } from './events.js'

const DAY = 86_400_000
export const TRIAL_PLAN = 'pro'

/** Reverse trial: a new account gets the full Pro experience, no card, then falls back to Free unless it subscribes. */
export function startTrial(ctx: Ctx, userId: string) {
  if (ctx.config.trialDays <= 0) return null
  const ends = new Date(ctx.now().getTime() + ctx.config.trialDays * DAY).toISOString()
  ctx.db.run('UPDATE users SET plan = ?, trial_ends_at = ? WHERE id = ?', [TRIAL_PLAN, ends, userId])
  track(ctx.db, 'trial_started', userId)
  return ends
}

/**
 * Bring what we monitor in line with the account's current plan. Oldest entries keep their
 * place; the rest are paused (never deleted) and resume automatically when there's room again.
 * Run after anything that changes a plan: trial expiry, subscription changes.
 */
export function enforceLimits(ctx: Ctx, userId: string) {
  const user = ctx.db.get<{ plan: string }>('SELECT plan FROM users WHERE id = ?', [userId])
  if (!user) return { paused: 0, resumed: 0 }
  const limits = getPlan(user.plan).limits
  const nowIso = ctx.now().toISOString()
  let paused = 0
  let resumed = 0
  for (const [table, limit] of [
    ['monitored_urls', limits.urls],
    ['backlinks', limits.backlinks],
  ] as const) {
    const ids = ctx.db.all<{ id: string; paused: number }>(
      `SELECT t.id, t.paused FROM ${table} t JOIN projects p ON p.id = t.project_id WHERE p.user_id = ? ORDER BY t.created_at, t.id`,
      [userId],
    )
    ctx.db.tx(() => {
      ids.forEach((r, i) => {
        if (i >= limit && !r.paused) {
          ctx.db.run(`UPDATE ${table} SET paused = 1, next_check_at = NULL WHERE id = ?`, [r.id])
          paused++
        } else if (i < limit && r.paused) {
          ctx.db.run(`UPDATE ${table} SET paused = 0, next_check_at = ? WHERE id = ?`, [nowIso, r.id])
          resumed++
        }
      })
    })
  }
  return { paused, resumed }
}

/** Hourly: remind three days before a trial ends, and end trials that are over. */
export async function processTrials(ctx: Ctx) {
  const nowIso = ctx.now().toISOString()
  const soon = new Date(ctx.now().getTime() + 3 * DAY).toISOString()
  const app = ctx.config.appUrl
  let reminded = 0
  let ended = 0

  const ending = ctx.db.all<{ id: string; email: string; name: string; trial_ends_at: string }>(
    'SELECT id, email, name, trial_ends_at FROM users WHERE trial_ends_at IS NOT NULL AND trial_ends_at > ? AND trial_ends_at <= ? AND trial_reminded = 0',
    [nowIso, soon],
  )
  for (const u of ending) {
    ctx.db.run('UPDATE users SET trial_reminded = 1 WHERE id = ?', [u.id])
    const days = Math.max(1, Math.ceil((new Date(u.trial_ends_at).getTime() - ctx.now().getTime()) / DAY))
    await ctx.notifier
      .email(
        u.email,
        `Your Indexora Pro trial ends in ${days} day${days === 1 ? '' : 's'}`,
        `Hi ${u.name.split(' ')[0] || 'there'},\n\nYour free Pro trial ends on ${u.trial_ends_at.slice(0, 10)}. After that your account moves to the Free plan: ` +
          `1 project, 100 URLs and 100 backlinks, with backlinks checked weekly instead of daily. Nothing is deleted — anything over those limits is paused, and resumes if you upgrade.\n\n` +
          `Keep everything running (founding prices are locked in for life): ${app}/app/settings?tab=billing\n\nQuestions? Just reply to this email.`,
      )
      .catch((e) => console.error('[trial] reminder failed', u.id, e))
    reminded++
  }

  const over = ctx.db.all<{ id: string; email: string; name: string; subscription_id: string | null }>(
    'SELECT id, email, name, subscription_id FROM users WHERE trial_ends_at IS NOT NULL AND trial_ends_at <= ?',
    [nowIso],
  )
  for (const u of over) {
    // A subscription started during the trial already set the real plan; just close the trial.
    if (u.subscription_id) {
      ctx.db.run('UPDATE users SET trial_ends_at = NULL WHERE id = ?', [u.id])
      continue
    }
    ctx.db.run("UPDATE users SET plan = 'free', trial_ends_at = NULL WHERE id = ?", [u.id])
    const { paused } = enforceLimits(ctx, u.id)
    track(ctx.db, 'trial_ended', u.id)
    await ctx.notifier
      .email(
        u.email,
        'Your Indexora trial has ended',
        `Hi ${u.name.split(' ')[0] || 'there'},\n\nYour Pro trial is over and your account is now on the Free plan.` +
          (paused ? ` ${paused} monitored item${paused === 1 ? ' is' : 's are'} over the Free limits and now paused — nothing was deleted.` : '') +
          `\n\nPick a plan to resume everything: ${app}/app/settings?tab=billing`,
      )
      .catch((e) => console.error('[trial] end email failed', u.id, e))
    ended++
  }
  return { reminded, ended }
}
