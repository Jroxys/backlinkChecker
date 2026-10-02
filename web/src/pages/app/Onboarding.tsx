import { useState } from 'react'
import { Check, Globe, Link2, ShieldCheck, Upload, ArrowRight, ExternalLink } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import { useNavigate } from '@/lib/router'
import { useMe } from '@/api/hooks'
import { useSource } from '@/api/source'
import { ApiError } from '@/api/client'
import type { Project } from '@/api/types'
import { useProject } from '@/lib/project'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Controls'
import { Select } from '@/components/ui/Dropdown'
import { useToast } from '@/components/ui/Toast'
import { LogoMark } from '@/components/ui/Logo'

const steps = ['Your website', 'Search Console', 'Backlinks']

export function Onboarding() {
  const source = useSource()
  const me = useMe()
  const { projects, setProjectId } = useProject()
  const [step, setStep] = useState(projects.length ? 1 : 0)
  const [project, setProject] = useState<Project | undefined>(projects[0])
  const nav = useNavigate()
  const qc = useQueryClient()

  const done = () => {
    qc.invalidateQueries({ queryKey: [source.mode] })
    nav('/app')
  }

  return (
    <div className="mx-auto max-w-2xl py-4">
      <div className="mb-8 flex items-center gap-3">
        <LogoMark size={32} />
        <div>
          <h1 className="heading text-[22px] font-semibold text-fg">Let’s set up your first project</h1>
          <p className="text-[13.5px] text-fg-3">Takes about two minutes. Your first checks start the moment you add a site.</p>
        </div>
      </div>

      <ol className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'tnum flex size-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold',
                i < step ? 'bg-primary text-white' : i === step ? 'bg-primary-soft text-primary-ink ring-1 ring-primary/40' : 'bg-surface-3 text-fg-4',
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('hidden text-[12.5px] font-medium sm:inline', i <= step ? 'text-fg' : 'text-fg-4')}>{s}</span>
            {i < steps.length - 1 && <span className={cn('h-px flex-1', i < step ? 'bg-primary' : 'bg-line')} />}
          </li>
        ))}
      </ol>

      <Card className="animate-rise p-6" key={step}>
        {step === 0 && (
          <StepSite
            onCreated={(p) => {
              setProject(p)
              setProjectId(p.id)
              qc.invalidateQueries({ queryKey: [source.mode, 'projects'] })
              setStep(1)
            }}
          />
        )}
        {step === 1 && project && (
          <StepGoogle project={project} configured={me.data?.google.configured ?? false} connected={me.data?.google.connected ?? false} onNext={() => setStep(2)} />
        )}
        {step === 2 && project && <StepBacklinks project={project} onDone={done} />}
      </Card>
    </div>
  )
}

function StepSite({ onCreated }: { onCreated: (p: Project) => void }) {
  const source = useSource()
  const toast = useToast()
  const [domain, setDomain] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      onCreated(await source.createProject({ domain }))
      toast({ title: 'Project created', description: 'We’re reading your sitemap and checking your homepage now.' })
    } catch (e) {
      toast({ title: 'Could not add this site', description: (e as ApiError).message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <StepTitle icon={<Globe />} title="Which website should we monitor?" text="We’ll find its sitemaps automatically and start checking every listed URL." />
      <Label>Domain</Label>
      <div className="relative">
        <Globe className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-4" />
        <Input autoFocus value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="pl-9" />
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="submit" variant="primary" disabled={!/\w+\.\w+/.test(domain)} loading={busy} rightIcon={<ArrowRight />}>
          Add website
        </Button>
      </div>
    </form>
  )
}

function StepGoogle({ project, configured, connected, onNext }: { project: Project; configured: boolean; connected: boolean; onNext: () => void }) {
  const source = useSource()
  const toast = useToast()
  const [sites, setSites] = useState<{ siteUrl: string }[] | null>(null)
  const [choice, setChoice] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const s = await source.googleSites()
      setSites(s)
      const guess = s.find((x) => x.siteUrl.includes(project.domain))
      setChoice(guess?.siteUrl ?? s[0]?.siteUrl ?? '')
    } catch (e) {
      toast({ title: 'Could not list your properties', description: (e as ApiError).message, tone: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    try {
      await source.updateProject(project.id, { gscProperty: choice })
      toast({ title: 'Search Console linked', description: `Index status for ${project.domain} will come straight from Google.` })
      onNext()
    } catch (e) {
      toast({ title: 'Could not save', description: (e as ApiError).message, tone: 'error' })
    }
  }

  return (
    <div>
      <StepTitle
        icon={<ShieldCheck />}
        title="Connect Google Search Console"
        text="Optional, but it’s how we know what Google actually indexed. We ask for read-only access and never change anything in your account."
      />
      {!configured ? (
        <p className="rounded-lg border border-line bg-surface-2 p-3.5 text-[13px] text-fg-3">
          Google sign-in isn’t configured on this server yet. You can still monitor indexability (status codes, noindex, canonicals, robots.txt) and backlinks.
        </p>
      ) : !connected ? (
        <a href="/api/google/connect?return=/app/onboarding">
          <Button variant="secondary" size="lg" className="w-full" rightIcon={<ExternalLink />}>
            Connect with Google
          </Button>
        </a>
      ) : sites === null ? (
        <Button variant="secondary" className="w-full" loading={loading} onClick={load}>
          Choose the Search Console property
        </Button>
      ) : sites.length === 0 ? (
        <p className="text-[13px] text-fg-3">No verified properties found on this Google account. Verify {project.domain} in Search Console first.</p>
      ) : (
        <div>
          <Label>Property</Label>
          <Select value={choice} onChange={setChoice} width={380} options={sites.map((s) => ({ value: s.siteUrl, label: s.siteUrl }))} />
        </div>
      )}
      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={onNext}>
          Skip for now
        </Button>
        {sites && sites.length > 0 && (
          <Button variant="primary" onClick={save} rightIcon={<ArrowRight />}>
            Use this property
          </Button>
        )}
      </div>
    </div>
  )
}

function StepBacklinks({ project, onDone }: { project: Project; onDone: () => void }) {
  const source = useSource()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const importNow = async () => {
    setBusy(true)
    try {
      const r = await source.importBacklinks(project.id, text)
      toast({ title: `${r.created.length} backlinks added`, description: `We’ll verify each one over the next few minutes${r.skipped.length ? ` · ${r.skipped.length} skipped` : ''}.` })
      onDone()
    } catch (e) {
      toast({ title: 'Import failed', description: (e as ApiError).message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <StepTitle icon={<Link2 />} title="Add the backlinks you already have" text="Paste linking page URLs (one per line) or upload a CSV export. We’ll verify every one of them daily." />
      <ol className="mb-4 space-y-1.5 rounded-lg border border-line bg-surface-2 p-3.5 text-[12.5px] text-fg-3">
        <li>
          <span className="font-medium text-fg-2">Free source:</span> Search Console → Links → <span className="font-medium text-fg-2">Latest links</span> → Export → CSV
        </li>
        <li>Ahrefs, Semrush and Moz backlink exports work too.</li>
      </ol>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={'https://blog.example.org/best-tools\nhttps://news.example.net/article-mentioning-you'}
        className="w-full resize-none rounded-lg border border-line bg-surface p-3 font-mono text-[12.5px] text-fg shadow-xs placeholder:text-fg-4 focus:border-primary focus:ring-3 focus:ring-[var(--ring)] focus:outline-none"
      />
      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-primary-ink hover:underline">
        <Upload className="size-3.5" />
        Upload CSV
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) setText(await f.text())
          }}
        />
      </label>
      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={onDone}>
          Skip — go to dashboard
        </Button>
        <Button variant="primary" disabled={!text.trim()} loading={busy} onClick={importNow} rightIcon={<ArrowRight />}>
          Import and finish
        </Button>
      </div>
    </div>
  )
}

function StepTitle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary-soft text-primary [&_svg]:size-4">{icon}</span>
      <div>
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        <p className="mt-0.5 text-[13px] text-fg-3">{text}</p>
      </div>
    </div>
  )
}
