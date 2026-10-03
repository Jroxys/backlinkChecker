import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { migrations } from './migrations.js'

export type Row = Record<string, SQLInputValue | null>
export type Params = Record<string, SQLInputValue | undefined> | SQLInputValue[]

/**
 * Thin wrapper over node:sqlite. Named parameters use `:name` syntax.
 * Kept deliberately small so swapping the driver later touches one file.
 */
export class Db {
  readonly raw: DatabaseSync

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.raw = new DatabaseSync(path)
    this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  }

  /** Named params: only bind keys the statement uses (node:sqlite rejects extras); undefined → NULL. */
  private bind(sql: string, params?: Params): SQLInputValue[] | [Record<string, SQLInputValue>] {
    if (!params) return []
    if (Array.isArray(params)) return params
    const clean: Record<string, SQLInputValue> = {}
    for (const [k, v] of Object.entries(params)) if (new RegExp(`[:@$]${k}\\b`).test(sql)) clean[k] = v === undefined ? null : v
    return [clean]
  }

  get<T = Row>(sql: string, params?: Params): T | undefined {
    return this.raw.prepare(sql).get(...(this.bind(sql, params) as SQLInputValue[])) as T | undefined
  }

  all<T = Row>(sql: string, params?: Params): T[] {
    return this.raw.prepare(sql).all(...(this.bind(sql, params) as SQLInputValue[])) as T[]
  }

  run(sql: string, params?: Params) {
    return this.raw.prepare(sql).run(...(this.bind(sql, params) as SQLInputValue[]))
  }

  tx<T>(fn: () => T): T {
    this.raw.exec('BEGIN IMMEDIATE')
    try {
      const out = fn()
      this.raw.exec('COMMIT')
      return out
    } catch (e) {
      this.raw.exec('ROLLBACK')
      throw e
    }
  }

  migrate() {
    this.raw.exec('CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)')
    const done = new Set(this.all<{ id: number }>('SELECT id FROM _migrations').map((r) => r.id))
    for (const m of migrations) {
      if (done.has(m.id)) continue
      this.tx(() => {
        this.raw.exec(m.sql)
        this.run('INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)', [m.id, m.name, new Date().toISOString()])
      })
    }
  }

  close() {
    this.raw.close()
  }
}

export function openDb(path: string) {
  const db = new Db(path)
  db.migrate()
  return db
}
