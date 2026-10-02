import type { IndexStatus } from '@/api/types'
import type { Tone } from '@/components/ui/Badge'

export const statusMeta: Record<IndexStatus, { label: string; tone: Tone; help: string }> = {
  indexed: { label: 'Indexed', tone: 'success', help: 'Google has indexed this URL and it can appear in search results.' },
  crawled: {
    label: 'Crawled – Not Indexed',
    tone: 'warning',
    help: 'Googlebot fetched the page but chose not to index it — usually a quality or duplication signal.',
  },
  discovered: {
    label: 'Discovered – Not Indexed',
    tone: 'neutral',
    help: 'Google knows the URL exists but has not crawled it yet. Often a crawl budget or internal linking issue.',
  },
  blocked: { label: 'Blocked', tone: 'neutral', help: 'Excluded by robots.txt or a noindex directive.' },
  error: { label: 'Error', tone: 'error', help: 'The server returned an error (4xx/5xx) when Google tried to fetch the URL.' },
  unknown: {
    label: 'Not checked',
    tone: 'outline',
    help: 'Google index status appears here once Search Console is connected and the URL has been inspected.',
  },
}

export const statusOrder: IndexStatus[] = ['indexed', 'crawled', 'discovered', 'blocked', 'error', 'unknown']
