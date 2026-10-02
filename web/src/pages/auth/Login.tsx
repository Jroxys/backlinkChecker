import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Controls'
import { AuthLayout } from './AuthLayout'

function FormError({ message }: { message: string | null }) {
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
      nav(params.get('next') ?? '/app', { replace: true })
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
          <Link to="/signup" className="font-medium text-primary-ink hover:underline">
            Create a free account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <div>
          <Label>Email</Label>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}

export function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [params] = useSearchParams()
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
      nav('/app/onboarding', { replace: true })
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
          <Link to="/login" className="font-medium text-primary-ink hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <div>
          <Label>Name</Label>
          <Input autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </div>
        <div>
          <Label>Work email</Label>
          <Input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label hint="At least 10 characters">Password</Label>
          <Input type="password" autoComplete="new-password" required minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
        <p className="text-center text-[12px] text-fg-4">By continuing you agree to the Terms and Privacy Policy.</p>
      </form>
    </AuthLayout>
  )
}
