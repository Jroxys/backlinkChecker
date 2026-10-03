import { trialDaysLeft } from '@/api/types'
import { useLocation } from 'react-router-dom'
import { NavLink, useAppPath } from '@/lib/router'
import { PanelLeftClose, PanelLeftOpen, ArrowUpRight, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import { ProgressBar } from '@/components/ui/Controls'
import { navGroups, settingsItem, adminItem, type NavItem } from './nav'
import { useSource } from '@/api/source'
import { useAlerts, useMe, useOpportunities } from '@/api/hooks'
import { useProject } from '@/lib/project'
import { Link } from '@/lib/router'
import { formatNumber } from '@/utils/format'

function Item({ item, collapsed, onNavigate, badge }: { item: NavItem; collapsed: boolean; onNavigate?: () => void; badge?: number }) {
  const pathname = useAppPath(useLocation().pathname)
  const active = item.to === '/app' ? pathname === '/app' : pathname.startsWith(item.to)
  const Icon = item.icon
  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={cn(
        'group relative flex h-8 items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150',
        collapsed ? 'w-8 justify-center' : 'px-2.5',
        active ? 'bg-surface text-fg shadow-xs ring-1 ring-line dark:bg-surface-3' : 'text-fg-2 hover:bg-surface-3 hover:text-fg',
      )}
    >
      {active && !collapsed && <span className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-primary" />}
      <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-fg-3 group-hover:text-fg-2')} strokeWidth={1.9} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && !!badge && (
        <span
          className={cn(
            'tnum rounded-md px-1.5 text-[11px] leading-5',
            active ? 'bg-primary-soft text-primary-ink' : 'bg-surface-3 text-fg-3 dark:bg-surface',
          )}
        >
          {badge}
        </span>
      )}
      {collapsed && !!badge && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />}
    </NavLink>
  )
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
  mobile,
}: {
  collapsed: boolean
  onToggle?: () => void
  onNavigate?: () => void
  mobile?: boolean
}) {
  const me = useMe().data
  const source = useSource()
  const { project } = useProject()
  const unread = useAlerts().data?.unread ?? 0
  const opps = useOpportunities(project?.id).data?.opportunities.length ?? 0
  const badges: Record<string, number> = { '/app/alerts': unread, '/app/opportunities': opps }
  const used = me ? Math.max(me.usage.urls / me.plan.limits.urls, me.usage.backlinks / me.plan.limits.backlinks) : 0
  const tight = me ? (me.usage.urls / me.plan.limits.urls >= me.usage.backlinks / me.plan.limits.backlinks ? 'urls' : 'backlinks') : 'urls'
  return (
    <nav
      aria-label="Main"
      className={cn(
        'flex h-full flex-col border-r border-line bg-bg transition-[width] duration-200 ease-out',
        collapsed ? 'w-[60px]' : 'w-[232px]',
      )}
    >
      {mobile && (
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <Logo />
          <button onClick={onNavigate} aria-label="Close navigation" className="rounded-lg p-1.5 text-fg-3 hover:bg-surface-3 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className={cn('no-scrollbar flex-1 overflow-y-auto py-3', collapsed ? 'px-[14px]' : 'px-3')}>
        {navGroups.map((g, gi) => (
          <div key={gi} className={cn(gi > 0 && 'mt-5')}>
            {g.label && !collapsed && <div className="eyebrow mb-1.5 px-2.5 !text-[10.5px] !text-fg-4">{g.label}</div>}
            {g.label && collapsed && <div className="mx-auto mb-2 h-px w-5 bg-line" />}
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <Item key={it.to} item={it} collapsed={collapsed} onNavigate={onNavigate} badge={badges[it.to]} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {!collapsed && me && (
        <div className="mx-3 mb-3 rounded-xl border border-line bg-surface p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-fg">{me.plan.name} {me.trialEndsAt ? 'trial' : 'plan'}</span>
            {me.trialEndsAt ? (
              <span className="text-[11px] text-primary-ink">{trialDaysLeft(me.trialEndsAt)} days left</span>
            ) : (
              me.user.founding && <span className="text-[11px] text-primary-ink">Founding</span>
            )}
          </div>
          <div className="mt-2.5 flex items-baseline justify-between text-[11.5px] text-fg-3">
            <span>{tight === 'urls' ? 'Monitored URLs' : 'Tracked backlinks'}</span>
            <span className="tnum">
              <span className="font-medium text-fg-2">{formatNumber(tight === 'urls' ? me.usage.urls : me.usage.backlinks)}</span> / {formatNumber(tight === 'urls' ? me.plan.limits.urls : me.plan.limits.backlinks)}
            </span>
          </div>
          <ProgressBar value={used * 100} tone={used > 0.9 ? 'warning' : 'primary'} className="mt-1.5" />
          {(me.plan.id !== 'agency' || me.trialEndsAt) && me.team?.role !== 'member' && (
            <Link to="/app/settings?tab=billing" onClick={onNavigate} className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-medium text-primary-ink hover:underline">
              {me.trialEndsAt ? `Keep ${me.plan.name} — from $${me.plan.founding || me.plan.monthly}/mo` : me.plan.id === 'free' ? 'Upgrade — from $9/mo' : 'Compare plans'} <ArrowUpRight className="size-3" />
            </Link>
          )}
        </div>
      )}

      <div className={cn('space-y-0.5 border-t border-line py-2', collapsed ? 'px-[14px]' : 'px-3')}>
        {source.mode === 'live' && me?.user.isAdmin && <Item item={adminItem} collapsed={collapsed} onNavigate={onNavigate} />}
        <Item item={settingsItem} collapsed={collapsed} onNavigate={onNavigate} />
        {!mobile && onToggle && (
          <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="right" className="w-full">
            <button
              onClick={onToggle}
              className={cn(
                'flex h-8 items-center gap-2.5 rounded-lg text-[13px] font-medium text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg',
                collapsed ? 'w-8 justify-center' : 'w-full px-2.5',
              )}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              {!collapsed && 'Collapse'}
            </button>
          </Tooltip>
        )}
      </div>
    </nav>
  )
}
