import type { Db } from '../db/index.js'

export type EventName = 'signup' | 'project_created' | 'backlinks_added' | 'gsc_connected' | 'gsc_property_set' | 'checkout_started' | 'subscribed' | 'tool_backlink_check' | 'tool_indexability_check' | 'tool_ssl_check' | 'tool_redirect_check' | 'trial_started' | 'trial_ended' | 'team_invite_sent' | 'team_joined'

/** Record a product event. Never throws — analytics must not break the product. */
export function track(db: Db, name: EventName, userId?: string | null) {
  try {
    db.run('INSERT INTO events (name, user_id, at) VALUES (?, ?, ?)', [name, userId ?? null, new Date().toISOString()])
  } catch {
    /* ignore */
  }
}
