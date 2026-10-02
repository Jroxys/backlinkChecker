import type { Db } from '../db/index.js'
import { addHours, id } from '../lib/ids.js'

export interface Job {
  id: string
  kind: string
  payload: string
  attempts: number
}

/**
 * Durable job queue on top of SQLite. Good for one process (or a few, thanks to
 * the atomic claim). When volume outgrows it, swap for pg-boss / BullMQ.
 */
export function enqueue(db: Db, kind: string, payload: unknown = {}, opts: { runAt?: Date; dedupeKey?: string } = {}) {
  const r = db.run(
    `INSERT OR IGNORE INTO jobs (id, kind, payload, run_at, dedupe_key, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id('job'), kind, JSON.stringify(payload), (opts.runAt ?? new Date()).toISOString(), opts.dedupeKey ?? null, new Date().toISOString()],
  )
  return r.changes > 0
}

export function claim(db: Db, at = new Date()): Job | undefined {
  return db.get<Job>(
    `UPDATE jobs SET status = 'running', locked_at = :at, attempts = attempts + 1
      WHERE id = (SELECT id FROM jobs WHERE status = 'queued' AND run_at <= :at ORDER BY run_at LIMIT 1)
      RETURNING id, kind, payload, attempts`,
    { at: at.toISOString() },
  )
}

/** Finished jobs release their dedupe key so the same periodic job can be queued again. */
export function complete(db: Db, jobId: string) {
  db.run("UPDATE jobs SET status = 'done', dedupe_key = NULL, locked_at = NULL WHERE id = ?", [jobId])
}

export function fail(db: Db, job: Job, err: unknown, maxAttempts = 5) {
  const msg = err instanceof Error ? err.message : String(err)
  if (job.attempts >= maxAttempts) {
    db.run("UPDATE jobs SET status = 'failed', last_error = ?, dedupe_key = NULL, locked_at = NULL WHERE id = ?", [msg, job.id])
  } else {
    const backoffMin = 2 ** job.attempts
    db.run("UPDATE jobs SET status = 'queued', last_error = ?, locked_at = NULL, run_at = ? WHERE id = ?", [msg, addHours(new Date(), backoffMin / 60), job.id])
  }
}

/** Jobs stuck in 'running' (process crashed mid-job) go back to the queue. */
export function recoverStale(db: Db, olderThanMinutes = 30) {
  return db.run("UPDATE jobs SET status = 'queued', locked_at = NULL WHERE status = 'running' AND locked_at < ?", [addHours(new Date(), -olderThanMinutes / 60)]).changes
}

/** Keep the table small: drop finished jobs after a week. */
export function prune(db: Db) {
  db.run("DELETE FROM jobs WHERE status IN ('done', 'failed') AND created_at < ?", [addHours(new Date(), -24 * 7)])
}
