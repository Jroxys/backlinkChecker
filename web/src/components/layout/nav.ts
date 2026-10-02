import {
  LayoutDashboard,
  FolderKanban,
  ScanSearch,
  Link2,
  ShieldCheck,
  KeyRound,
  Swords,
  FileBarChart2,
  Bell,
  Settings,
  Workflow,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: string
  children?: { to: string; label: string }[]
}

export const navGroups: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/app/projects', label: 'Projects', icon: FolderKanban },
    ],
  },
  {
    label: 'Monitor',
    items: [
      { to: '/app/indexing', label: 'Indexing', icon: ScanSearch },
      { to: '/app/backlinks', label: 'Backlinks', icon: Link2 },
      { to: '/app/opportunities', label: 'Opportunities', icon: Sparkles, badge: '12' },
      { to: '/app/audit', label: 'SEO Audit', icon: ShieldCheck },
      { to: '/app/keywords', label: 'Keywords', icon: KeyRound },
      { to: '/app/competitors', label: 'Competitors', icon: Swords },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { to: '/app/automations', label: 'Automations', icon: Workflow },
      { to: '/app/reports', label: 'Reports', icon: FileBarChart2 },
      { to: '/app/alerts', label: 'Alerts', icon: Bell, badge: '4' },
    ],
  },
]

export const settingsItem: NavItem = { to: '/app/settings', label: 'Settings', icon: Settings }
