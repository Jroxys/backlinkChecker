import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronsUpDown, CircleHelp, LogOut, Menu, Moon, Search, Settings, Sun, User, CreditCard, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'
import { currentUser } from '@/lib/user'
import { Logo } from '@/components/ui/Logo'
import { Kbd } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/Button'
import { Dropdown, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Dropdown'
import { Tooltip } from '@/components/ui/Tooltip'
import { alerts } from '@/data/alerts'
import { timeAgo } from '@/utils/format'
import { AlertIcon } from '@/components/AlertIcon'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export function Header({
  collapsed,
  onMenu,
  onSearch,
}: {
  collapsed: boolean
  onMenu: () => void
  onSearch: () => void
}) {
  const { theme, toggle } = useTheme()
  const nav = useNavigate()
  const unread = alerts.filter((a) => !a.read)
  const desktop = useMediaQuery('(min-width: 1024px)')

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b border-line bg-bg/85 backdrop-blur-md">
      <div
        className={cn(
          'flex h-full shrink-0 items-center gap-2 px-4 transition-[width] duration-200 lg:border-r lg:border-line',
          collapsed ? 'lg:w-[60px] lg:justify-center lg:px-0' : 'lg:w-[232px]',
        )}
      >
        <IconButton label="Open navigation" onClick={onMenu} className="-ml-1.5 lg:hidden">
          <Menu />
        </IconButton>
        <Link to="/app" aria-label="Indexora home" className="flex items-center">
          <Logo collapsed={collapsed && desktop} />
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 sm:px-5">
        <div className="hidden md:block">
        <Dropdown
          width={260}
          trigger={({ toggle: t, open }) => (
            <button
              onClick={t}
              aria-expanded={open}
              className="flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-3"
            >
              <span className="flex size-5 items-center justify-center rounded-md bg-[#0B0F19] text-[10px] font-bold text-white dark:bg-white dark:text-[#0B0F19]">
                N
              </span>
              {currentUser.workspace}
              <ChevronsUpDown className="size-3.5 text-fg-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuLabel>Workspaces</MenuLabel>
              <MenuItem selected onClick={close}>
                Northwind Studio
              </MenuItem>
              <MenuItem onClick={close}>Fern & Pine (client)</MenuItem>
              <MenuSeparator />
              <MenuItem onClick={close}>Create workspace…</MenuItem>
            </>
          )}
        </Dropdown>
        </div>
        <span className="hidden h-5 w-px bg-line md:block" />
        <button
          onClick={onSearch}
          aria-label="Search" className="group ml-auto flex h-8 min-w-0 items-center gap-2 rounded-lg px-2 text-[13px] text-fg-3 transition-colors hover:bg-surface-3 sm:ml-0 sm:w-full sm:max-w-[380px] sm:border sm:border-line sm:bg-surface sm:px-2.5 sm:text-fg-4 sm:shadow-xs sm:hover:border-line-strong sm:hover:bg-surface"
        >
          <Search className="size-4 shrink-0" />
          <span className="hidden truncate sm:inline">Search URLs, projects, pages…</span>
          <span className="ml-auto hidden items-center gap-0.5 sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      <div className="flex items-center gap-1 pr-3 sm:pr-4">
        <Tooltip content={theme === 'dark' ? 'Light mode' : 'Dark mode'} side="bottom">
          <IconButton label="Toggle theme" onClick={toggle}>
            {theme === 'dark' ? <Sun /> : <Moon />}
          </IconButton>
        </Tooltip>
        <Tooltip content="Help & docs" side="bottom" className="hidden sm:inline-flex">
          <IconButton label="Help">
            <CircleHelp />
          </IconButton>
        </Tooltip>

        <Dropdown
          align="right"
          width={360}
          trigger={({ toggle: t, open }) => (
            <IconButton label="Notifications" onClick={t} className={cn('relative', open && 'bg-surface-3 text-fg')}>
              <Bell />
              {unread.length > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-bg" />
              )}
            </IconButton>
          )}
        >
          {(close) => (
            <div>
              <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
                <span className="text-[13px] font-semibold text-fg">Notifications</span>
                <span className="tnum text-[11.5px] text-fg-3">{unread.length} unread</span>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {alerts.slice(0, 5).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      nav(a.href)
                      close()
                    }}
                    className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-surface-3"
                  >
                    <AlertIcon alert={a} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-fg">{a.title}</p>
                      <p className="mt-0.5 truncate text-[12px] text-fg-3">
                        {a.project} · {timeAgo(a.time)}
                      </p>
                    </div>
                    {!a.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
                  </button>
                ))}
              </div>
              <MenuSeparator />
              <button
                onClick={() => {
                  nav('/app/alerts')
                  close()
                }}
                className="w-full rounded-lg px-2.5 py-2 text-center text-[12.5px] font-medium text-primary-ink hover:bg-surface-3"
              >
                View all alerts
              </button>
            </div>
          )}
        </Dropdown>

        <Dropdown
          align="right"
          width={240}
          trigger={({ toggle: t }) => (
            <button onClick={t} className="ml-1 rounded-full" aria-label="Account menu">
              <Avatar initials={currentUser.initials} size={30} />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-2.5 pt-2 pb-2.5">
                <p className="text-[13px] font-semibold text-fg">
                  {currentUser.firstName} {currentUser.lastName}
                </p>
                <p className="text-[12px] text-fg-3">{currentUser.email}</p>
              </div>
              <MenuSeparator />
              <MenuItem icon={<User />} onClick={() => (nav('/app/settings'), close())}>
                Profile
              </MenuItem>
              <MenuItem icon={<CreditCard />} hint="Growth" onClick={() => (nav('/app/settings'), close())}>
                Billing
              </MenuItem>
              <MenuItem icon={<Settings />} onClick={() => (nav('/app/settings'), close())}>
                Settings
              </MenuItem>
              <MenuItem icon={theme === 'dark' ? <Check /> : <Moon />} onClick={toggle}>
                Dark mode
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<LogOut />} onClick={() => (nav('/'), close())}>
                Sign out
              </MenuItem>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  )
}
