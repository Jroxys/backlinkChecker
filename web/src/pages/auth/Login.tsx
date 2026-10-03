import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Controls'
import { AuthLayout } from './AuthLayout'

/** Only same-app paths: never let a crafted link bounce someone to another site after sign-in. */
const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : null)

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-error/25 bg-error-soft px-3 py-2.5 text-[13px] text-error-ink">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {message}
    </div>
  )
}

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const [params] = useSearchParams()
  const qc = useQueryClient()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/api/auth/login', { email, password })
      qc.clear()
      nav(safeNext(params.get('next')) ?? '/app', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Indexora workspace."
      footer={
        <>
          New to Indexora?{' '}
          <Link to={`/signup${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-medium text-primary-ink hover:underline">
            Create a free account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <div>
          <Label htmlFor="auth-1">Email</Label>
          <Input id="auth-1" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        {params.get('reset') && <div className="rounded-lg border border-success/25 bg-success-soft px-3 py-2.5 text-[13px] text-success-ink">Password updated. Sign in with your new password.</div>}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="auth-pw" className="text-[12.5px] font-medium text-fg-2">
              Password
            </label>
            <Link to="/forgot-password" className="text-[12px] font-medium text-primary-ink hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="auth-pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}

export function Signup() {
  const [params] = useSearchParams()
  const [form, setForm] = useState({ name: '', email: params.get('email') ?? '', password: '' })
  const plan = params.get('plan')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const qc = useQueryClient()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/api/auth/signup', form)
      try {
        if (plan && ['starter', 'pro', 'agency'].includes(plan)) sessionStorage.setItem('indexora-intended-plan', plan)
      } catch {
        /* ignore */
      }
      qc.clear()
      nav(safeNext(params.get('next')) ?? '/app/onboarding', { replace: true })
    } catch (err) {
      const d = err instanceof ApiError && Array.isArray(err.details) ? (err.details as { message: string }[]).map((x) => x.message).join('. ') : null
      setError(d || (err instanceof ApiError ? err.message : 'Could not create your account'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={plan && plan !== 'free' ? `Start free, then pick ${plan[0].toUpperCase() + plan.slice(1)} after setup. No card needed now.` : 'Free forever for one site. No credit card.'}
      footer={
        <>
          Already have an account?{' '}
          <Link to={`/login${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-medium text-primary-ink hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <div>
          <Label htmlFor="auth-2">Name</Label>
          <Input id="auth-2" autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </div>
        <div>
          <Label htmlFor="auth-3">Work email</Label>
          <Input id="auth-3" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="auth-4" hint="At least 10 characters">Password</Label>
          <Input id="auth-4" type="password" autoComplete="new-password" required minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
        <p className="text-center text-[12px] text-fg-4">By continuing you agree to the <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
      </form>
    </AuthLayout>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/api/auth/forgot', { email })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We’ll email you a link to choose a new one."
      footer={
        <Link to="/login" className="font-medium text-primary-ink hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-[13.5px] text-success-ink">If an account exists for {email}, a reset link is on its way. It works for one hour.</div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <FormError message={error} />
          <div>
            <Label htmlFor="auth-5">Email</Label>
            <Input id="auth-5" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

export function ResetPassword() {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/api/auth/reset', { token: params.get('token') ?? '', password })
      nav('/login?reset=1', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthLayout title="Choose a new password" subtitle="You’ll be signed out on all other devices." footer={null}>
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <div>
          <Label htmlFor="auth-6" hint="At least 10 characters">New password</Label>
          <Input id="auth-6" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
          Set new password
        </Button>
      </form>
    </AuthLayout>
  )
}
