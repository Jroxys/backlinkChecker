import type { Db } from '../db/index.js'

export function usageFor(db: Db, userId: string) {
  const one = (sql: string) => db.get<{ n: number }>(sql, [userId])!.n
  return {
    projects: one('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?'),
    urls: one('SELECT COUNT(*) AS n FROM monitored_urls m JOIN projects p ON p.id = m.project_id WHERE p.user_id = ?'),
    backlinks: one('SELECT COUNT(*) AS n FROM backlinks b JOIN projects p ON p.id = b.project_id WHERE p.user_id = ?'),
  }
}
