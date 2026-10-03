import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { usePageTitle } from '@/hooks/usePageTitle'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer: ReactNode }) {
  usePageTitle(`${title} — Indexora`)
  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg lg:grid-cols-[minmax(0,1fr)_520px]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link to="/" aria-label="Indexora home">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="heading text-[26px] font-semibold text-fg">{title}</h1>
          <p className="mt-1.5 text-[14px] text-fg-3">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-[13px] text-fg-3">{footer}</div>
        </div>
      </div>
      <div className="dark relative hidden overflow-hidden border-l border-line bg-bg lg:block">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_30%,black,transparent)]" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.3),transparent)]" />
        <div className="relative flex h-full flex-col justify-center px-12 text-fg">
          <p className="display text-[30px] leading-tight font-semibold">Know exactly what Google sees.</p>
          <ul className="mt-8 space-y-4 text-[14.5px] text-fg-2">
            {[
              'Every backlink re-verified daily — lost links alert you within a day',
              'Index status straight from Search Console, read-only access',
              'Indexability checks: noindex, canonical, robots.txt, status codes',
              'Free plan forever. Founding price locked for life.',
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                  <Check className="size-3 text-primary-light" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
