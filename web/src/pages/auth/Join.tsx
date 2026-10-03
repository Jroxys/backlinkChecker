import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import type { Me } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { AuthLayout } from './AuthLayout'
import { FormError } from './Login'

/** Landing page for team invite links: /join?token=… */
export function Join() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const nav = useNavigate()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get<{ ownerName: string; email: string; expired: boolean }>(`/api/team/invite?token=${encodeURIComponent(token)}`),
    enabled: !!token,
    retry: false,
  })
  const me = useQuery({ queryKey: ['join-me'], queryFn: () => api.get<Me>('/api/auth/me'), retry: false })
  const here = `/join?token=${encodeURIComponent(token)}`

  useEffect(() => setError(null), [token])

  const accept = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.post('/api/team/join', { token })
      qc.clear()
      nav('/app', { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not join the team')
    } finally {
      setBusy(false)
    }
  }

  const bad = !token || invite.isError || invite.data?.expired
  const inv = invite.data
  const signedIn = me.data?.user
  return (
    <AuthLayout
      title={bad ? 'Invite not valid' : inv ? `Join ${inv.ownerName}’s team` : 'Team invite'}
      subtitle={bad ? 'This link is invalid or has expired. Ask the person who invited you for a new one.' : inv ? `You’ve been invited as ${inv.email}.` : 'Checking your invite…'}
      footer={
        signedIn && !bad ? (
          <>
            Not {signedIn.email}?{' '}
            <button
              className="font-medium text-primary-ink hover:underline"
              onClick={async () => {
                await api.post('/api/auth/logout').catch(() => undefined)
                qc.clear()
                me.refetch()
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link to="/" className="font-medium text-primary-ink hover:underline">
            What is Indexora?
          </Link>
        )
      }
    >
      <FormError message={error} />
      {!bad && inv && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-[13px] text-fg-2">
            <Users className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>You’ll see and work on {inv.ownerName}’s projects — indexing, backlinks, audits and reports. Billing stays with them.</span>
          </div>
          {me.isLoading ? null : signedIn ? (
            <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={accept}>
              Join as {signedIn.email}
            </Button>
          ) : (
            <div className="grid gap-2">
              <Link to={`/signup?email=${encodeURIComponent(inv.email)}&next=${encodeURIComponent(here)}`}>
                <Button variant="primary" size="lg" className="w-full">
                  Create an account
                </Button>
              </Link>
              <Link to={`/login?next=${encodeURIComponent(here)}`}>
                <Button size="lg" className="w-full">
                  I already have an account
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </AuthLayout>
  )
}
