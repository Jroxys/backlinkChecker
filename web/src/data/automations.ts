import type { Automation } from '@/types'

export const automations: Automation[] = [
  { id: 'a1', name: 'Monitor new backlinks', kind: 'backlink', description: 'Detect new and lost backlinks across all referring domains.', frequency: 'Every 24 hours', channels: ['Email', 'Slack'], active: true, lastRun: '2026-10-02T02:30:00Z', nextRun: '2026-10-03T02:30:00Z', project: 'All projects', lastResult: '14 new · 5 lost', successRate: 100 },
  { id: 'a2', name: 'Index status check', kind: 'index', description: 'Inspect priority URLs with the URL Inspection API and flag status changes.', frequency: 'Every 6 hours', channels: ['Email'], active: true, lastRun: '2026-10-02T08:15:00Z', nextRun: '2026-10-02T14:15:00Z', project: 'northwindlabs.com', lastResult: '3 newly indexed', successRate: 99.4 },
  { id: 'a3', name: 'Full technical SEO scan', kind: 'audit', description: 'Crawl the full site and run 142 technical checks.', frequency: 'Weekly · Mon 02:00', channels: ['Email', 'Webhook'], active: true, lastRun: '2026-09-28T02:00:00Z', nextRun: '2026-10-05T02:00:00Z', project: 'All projects', lastResult: '23 issues (−5)', successRate: 100 },
  { id: 'a4', name: 'Sitemap change watcher', kind: 'sitemap', description: 'Diff every sitemap and alert on added, removed or non-200 URLs.', frequency: 'Every hour', channels: ['Slack'], active: true, lastRun: '2026-10-02T09:00:00Z', nextRun: '2026-10-02T10:00:00Z', project: 'northwindlabs.com', lastResult: '12 URLs added', successRate: 98.7 },
  { id: 'a5', name: 'Competitor backlink gap', kind: 'competitor', description: 'Compare referring domains against 3 competitors and surface gaps.', frequency: 'Every 7 days', channels: ['Email'], active: true, lastRun: '2026-09-29T04:00:00Z', nextRun: '2026-10-06T04:00:00Z', project: 'northwindlabs.com', lastResult: '12 opportunities', successRate: 100 },
  { id: 'a6', name: 'Monthly client report', kind: 'report', description: 'Generate and email the branded monthly SEO report.', frequency: 'Monthly · 1st 07:00', channels: ['Email'], active: true, lastRun: '2026-10-01T07:00:00Z', nextRun: '2026-11-01T07:00:00Z', project: 'fernandpine.co', lastResult: 'Sent to 3 recipients', successRate: 100 },
  { id: 'a7', name: 'robots.txt change detection', kind: 'audit', description: 'Snapshot robots.txt and alert on any directive change.', frequency: 'Every hour', channels: ['Email', 'Slack'], active: false, lastRun: '2026-09-21T11:00:00Z', nextRun: '—', project: 'docs.lumencraft.io', lastResult: 'Paused by Ömer', successRate: 100 },
]

export const nightlyTimeline = [
  { time: '02:00', title: 'Site crawl', detail: '1,525 URLs crawled · 2m 41s', status: 'done' as const },
  { time: '02:15', title: 'Index status check', detail: '312 priority URLs inspected', status: 'done' as const },
  { time: '02:30', title: 'Backlink scan', detail: '14 new · 5 lost backlinks', status: 'done' as const },
  { time: '02:45', title: 'Issue detection', detail: '2 new issues · 7 resolved', status: 'done' as const },
  { time: '03:00', title: 'Report generated', detail: 'Weekly report sent to 3 recipients', status: 'done' as const },
]
