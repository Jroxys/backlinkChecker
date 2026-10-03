import { Link } from '@/lib/router'
import { ArrowLeft, Compass } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'

export function NotFound({ inApp }: { inApp?: boolean }) {
  const body = (
    <EmptyState
      icon={<Compass />}
      title="This page isn’t indexed — even by us"
      description="The link may be outdated, or the page was moved. Head back and pick up where you left off."
      action={
        <Link to={inApp ? '/app' : '/'}>
          <Button variant="primary" leftIcon={<ArrowLeft />}>
            {inApp ? 'Back to dashboard' : 'Back to home'}
          </Button>
        </Link>
      }
    />
  )
  if (inApp) return <Card>{body}</Card>
  return <div className="flex min-h-screen items-center justify-center bg-bg p-6">{body}</div>
}
