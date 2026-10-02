import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'warning' | 'info'
interface ToastItem {
  id: number
  title: string
  description?: string
  tone: ToastTone
  leaving?: boolean
}

interface ToastCtx {
  toast: (t: { title: string; description?: string; tone?: ToastTone }) => void
}

const Ctx = createContext<ToastCtx | null>(null)

const icons = {
  success: <CheckCircle2 className="size-4 text-success" />,
  error: <XCircle className="size-4 text-error" />,
  warning: <AlertTriangle className="size-4 text-warning" />,
  info: <Info className="size-4 text-primary" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const id = useRef(0)

  const dismiss = useCallback((tid: number) => {
    setItems((xs) => xs.map((x) => (x.id === tid ? { ...x, leaving: true } : x)))
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== tid)), 180)
  }, [])

  const toast = useCallback<ToastCtx['toast']>(
    ({ title, description, tone = 'success' }) => {
      const tid = ++id.current
      setItems((xs) => [...xs.slice(-3), { id: tid, title, description, tone }])
      setTimeout(() => dismiss(tid), 4200)
    },
    [dismiss],
  )

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-pop',
              'transition-all duration-200',
              t.leaving ? 'translate-x-2 opacity-0' : 'animate-slide-in-right',
            )}
          >
            <span className="mt-0.5">{icons[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-fg">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[12.5px] leading-snug text-fg-3">{t.description}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="rounded-md p-0.5 text-fg-4 transition-colors hover:bg-surface-3 hover:text-fg-2"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.toast
}
