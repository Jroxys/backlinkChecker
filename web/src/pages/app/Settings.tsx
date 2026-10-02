import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Moon, Sun, Monitor, ShieldCheck, ExternalLink, Sparkles, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'
import { Link } from '@/lib/router'
import { useProject } from '@/lib/project'
import { useAction, useMe, usePlans } from '@/api/hooks'
import { useSource } from '@/api/source'
import { ApiError } from '@/api/client'
import type { PlanId } from '@/api/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, Segmented } from '@/components/ui/Tabs'
import { Label, ProgressBar } from '@/components/ui/Controls'
import { Avatar } from '@/components/ui/Avatar'
import { Select } from '@/components/ui/Dropdown'
import { useToast } from '@/components/ui/Toast'
import { formatDate, formatNumber } from '@/utils/format'

type Tab = 'general' | 'integrations' | 'billing'

export function Settings() {
  const [params, setParams] = useSearchParams()
  const initial = (params.get('tab') as Tab) || 'general'
  const [tab, setTab] = useState<Tab>(['general', 'integrations', 'billing'].includes(initial) ? initial : 'general')
  const toast = useToast()

  useEffect(() => {
    const g = params.get('google')
    if (!g) return
    if (g === 'connected') toast({ title: 'Google connected', description: 'Now choose the Search Console property for your project.' })
    else toast({ title: 'Google connection failed', description: g === 'denied' ? 'Access was not granted.' : 'Please try again.', tone: 'error' })
    params.delete('google')
    setParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <PageHeader title="Settings" description="Your account, connections and plan." />
      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'general', label: 'General' },
          { value: 'integrations', label: 'Integrations' },
          { value: 'billing', label: 'Plan & billing' },
        ]}
      />
      <div key={tab} className="max-w-3xl animate-rise space-y-4">
        {tab === 'general' && <General />}
        {tab === 'integrations' && <Integrations />}
        {tab === 'billing' && <Billing />}
      </div>
    </>
  )
}

function General() {
  const me = useMe().data
  const { theme, setTheme } = useTheme()
  const initials = (me?.user.name ?? '?')
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <>
      <Card>
        <CardHeader title="Account" />
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <Avatar initials={initials} size={48} />
            <div>
              <div className="text-[15px] font-semibold text-fg">{me?.user.name}</div>
              <div className="text-[13px] text-fg-3">{me?.user.email}</div>
              {me && <div className="mt-0.5 text-[12px] text-fg-4">Member since {formatDate(me.user.createdAt)}</div>}
            </div>
          </div>
          <p className="text-[12.5px] text-fg-4">Need to change your email or delete your account? Write to support and we’ll do it within a day.</p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Appearance" />
        <div className="grid grid-cols-3 gap-3 p-5">
          {(
            [
              ['light', 'Light', Sun],
              ['dark', 'Dark', Moon],
            ] as const
          ).map(([v, l, I]) => (
            <button
              key={v}
              onClick={() => setTheme(v)}
              className={cn('flex flex-col items-center gap-2 rounded-xl border p-4 text-[13px] font-medium transition-all', theme === v ? 'border-primary bg-primary-soft text-fg ring-3 ring-[var(--ring)]' : 'border-line text-fg-2 hover:border-line-strong')}
            >
              <I className={cn('size-5', theme === v ? 'text-primary' : 'text-fg-4')} />
              {l}
            </button>
          ))}
          <button
            onClick={() => setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')}
            className="flex flex-col items-center gap-2 rounded-xl border border-line p-4 text-[13px] font-medium text-fg-2 transition-all hover:border-line-strong"
          >
            <Monitor className="size-5 text-fg-4" />
            System
          </button>
        </div>
      </Card>
    </>
  )
}

function Integrations() {
  const source = useSource()
  const me = useMe()
  const { project } = useProject()
  const toast = useToast()
  const [sites, setSites] = useState<{ siteUrl: string; permissionLevel: string }[] | null>(null)
  const [choice, setChoice] = useState(project?.gscProperty ?? '')
  const google = me.data?.google
  const update = useAction((s) => s.updateProject, { invalidate: ['projects'], success: () => ({ title: 'Search Console property saved', description: 'Index status will be inspected over the next hours.' }) })
  const disconnect = useAction((s) => s.disconnectGoogle, { invalidate: ['me'], success: () => ({ title: 'Google disconnected' }) })

  useEffect(() => {
    if (!google?.connected) return
    source
      .googleSites()
      .then((s) => {
        setSites(s)
        if (!project?.gscProperty) setChoice(s.find((x) => project && x.siteUrl.includes(project.domain))?.siteUrl ?? s[0]?.siteUrl ?? '')
      })
      .catch((e: ApiError) => toast({ title: 'Could not list Search Console properties', description: e.message, tone: 'error' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google?.connected])

  return (
    <>
      <Card>
        <CardHeader
          title="Google Search Console"
          description="Read-only access. We never change anything in your account."
          icon={<ShieldCheck />}
          actions={google?.connected ? <Badge tone="success" icon={<Check />}>Connected</Badge> : undefined}
        />
        <div className="space-y-4 p-5">
          {!google?.configured ? (
            <p className="rounded-lg border border-line bg-surface-2 p-3.5 text-[13px] text-fg-3">Google sign-in isn’t configured on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).</p>
          ) : !google.connected ? (
            <a href={`/api/google/connect?return=/app/settings`}>
              <Button variant="primary" rightIcon={<ExternalLink />}>
                Connect Google Search Console
              </Button>
            </a>
          ) : (
            <>
              <div className="text-[13px] text-fg-2">
                Signed in as <span className="font-medium text-fg">{google.email ?? 'your Google account'}</span>
              </div>
              {project && (
                <div>
                  <Label hint={project.domain}>Property for this project</Label>
                  <div className="flex flex-wrap gap-2">
                    {sites === null ? (
                      <span className="text-[13px] text-fg-4">Loading properties…</span>
                    ) : sites.length === 0 ? (
                      <span className="text-[13px] text-fg-3">No verified properties on this account. Verify {project.domain} in Search Console first.</span>
                    ) : (
                      <>
                        <Select value={choice} onChange={setChoice} width={380} options={sites.map((s) => ({ value: s.siteUrl, label: s.siteUrl }))} />
                        <Button variant="primary" loading={update.isPending} disabled={!choice || choice === project.gscProperty} onClick={() => update.mutate([project.id, { gscProperty: choice }])}>
                          Save
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
              <button onClick={() => disconnect.mutate([])} className="text-[12.5px] font-medium text-error-ink hover:underline">
                Disconnect Google
              </button>
            </>
          )}
        </div>
      </Card>
      <Card className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 size-4 text-fg-4" />
          <div>
            <div className="text-[13.5px] font-medium text-fg">Slack & webhooks</div>
            <div className="text-[12.5px] text-fg-3">Send alerts to a channel or your own endpoint.</div>
          </div>
        </div>
        <Link to="/app/alerts">
          <Button size="sm">Configure</Button>
        </Link>
      </Card>
    </>
  )
}

function Billing() {
  const me = useMe().data
  const plans = usePlans().data
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const checkout = useAction((s) => s.checkout)
  if (!me || !plans) return null
  const u = me.usage
  const l = me.plan.limits
  const foundingLeft = plans.founding.left

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-semibold text-fg">{me.plan.name} plan</span>
              {me.user.founding && <Badge tone="primary" icon={<Sparkles />}>Founding customer</Badge>}
            </div>
            <p className="mt-1 text-[13px] text-fg-3">{me.plan.monthly === 0 ? 'Free forever for one site.' : `$${me.user.founding ? me.plan.founding : me.plan.monthly} / month`}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {(
            [
              ['Projects', u.projects, l.projects],
              ['Monitored URLs', u.urls, l.urls],
              ['Tracked backlinks', u.backlinks, l.backlinks],
            ] as const
          ).map(([label, used, max]) => (
            <div key={label}>
              <div className="flex justify-between text-[12.5px]">
                <span className="text-fg-3">{label}</span>
                <span className="tnum font-medium text-fg">
                  {formatNumber(used)} / {formatNumber(max)}
                </span>
              </div>
              <ProgressBar className="mt-2" value={(used / max) * 100} tone={used / max > 0.9 ? 'warning' : 'primary'} />
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={cycle}
          onChange={setCycle}
          items={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly · 2 months free' },
          ]}
        />
        {cycle === 'monthly' && foundingLeft > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-primary-ink">
            <Sparkles className="size-3.5" /> {foundingLeft} founding seats left — launch price locked for life
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {plans.plans
          .filter((p) => p.id !== 'free')
          .map((p) => {
            const current = p.id === me.plan.id
            const price = cycle === 'yearly' ? Math.round(p.yearly / 12) : foundingLeft > 0 ? p.founding : p.monthly
            return (
              <Card key={p.id} className={cn('flex flex-col p-5', p.id === 'pro' && 'border-primary')}>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-fg">{p.name}</span>
                  {p.id === 'pro' && <Badge size="xs" tone="primary">Recommended</Badge>}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="tnum text-[28px] font-semibold text-fg">${price}</span>
                  <span className="text-[12.5px] text-fg-3">/ mo</span>
                  {cycle === 'monthly' && foundingLeft > 0 && <span className="tnum text-[12.5px] text-fg-4 line-through">${p.monthly}</span>}
                </div>
                <ul className="mt-3 flex-1 space-y-1.5 text-[12.5px] text-fg-2">
                  <li>{formatNumber(p.limits.projects)} projects</li>
                  <li>{formatNumber(p.limits.urls)} URLs · {formatNumber(p.limits.backlinks)} backlinks</li>
                  <li>{p.limits.discovery ? 'Weekly new-link discovery' : 'Import & verify links'}</li>
                  {p.features.whiteLabel && <li>White-label reports</li>}
                </ul>
                <Button
                  className="mt-4 w-full"
                  variant={current ? 'secondary' : p.id === 'pro' ? 'primary' : 'secondary'}
                  disabled={current}
                  loading={checkout.isPending && checkout.variables?.[0] === p.id}
                  onClick={() => checkout.mutateAsync([p.id as Exclude<PlanId, 'free'>, cycle]).then((r) => (window.location.href = r.url), () => undefined)}
                >
                  {current ? 'Current plan' : `Choose ${p.name}`}
                </Button>
              </Card>
            )
          })}
      </div>
      <p className="text-[12px] text-fg-4">Payments are handled by Lemon Squeezy, our merchant of record — they add VAT/sales tax where required and issue your invoices.</p>
    </>
  )
}
