import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDb } from '../src/db/index.js'
import { claim, complete, enqueue, fail, recoverStale } from '../src/jobs/queue.js'

test('dedupe key prevents double-queueing until the job completes', () => {
  const db = openDb(':memory:')
  assert.equal(enqueue(db, 'x', {}, { dedupeKey: 'k' }), true)
  assert.equal(enqueue(db, 'x', {}, { dedupeKey: 'k' }), false)
  const j = claim(db)!
  complete(db, j.id)
  assert.equal(enqueue(db, 'x', {}, { dedupeKey: 'k' }), true)
})

test('claim is exclusive and respects run_at', () => {
  const db = openDb(':memory:')
  enqueue(db, 'later', {}, { runAt: new Date(Date.now() + 60_000) })
  enqueue(db, 'now')
  const j = claim(db)!
  assert.equal(j.kind, 'now')
  assert.equal(claim(db), undefined)
})

test('failures back off and eventually give up; stale running jobs are recovered', () => {
  const db = openDb(':memory:')
  enqueue(db, 'flaky')
  let j = claim(db)!
  fail(db, j, new Error('boom'), 2)
  assert.equal(claim(db), undefined, 'backed off into the future')
  db.run("UPDATE jobs SET run_at = '2000-01-01'")
  j = claim(db)!
  fail(db, j, new Error('boom'), 2)
  assert.equal(db.get<{ status: string }>('SELECT status FROM jobs')!.status, 'failed')

  enqueue(db, 'crashy')
  claim(db)
  db.run("UPDATE jobs SET locked_at = '2000-01-01' WHERE kind = 'crashy'")
  assert.equal(recoverStale(db), 1)
})
