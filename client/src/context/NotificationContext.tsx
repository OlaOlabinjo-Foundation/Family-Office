import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type Variant = 'success' | 'error' | 'info'

type Toast = { id: number; message: string; variant: Variant }

type NotifyApi = {
  show: (message: string, variant?: Variant) => void
  dismiss: (id: number) => void
}

const NotificationContext = createContext<NotifyApi | null>(null)

let toastSeq = 0

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const show = useCallback((message: string, variant: Variant = 'info') => {
    const id = ++toastSeq
    setToasts((t) => [...t, { id, message, variant }])
    window.setTimeout(() => dismiss(id), 4200)
  }, [dismiss])

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex max-w-[min(100vw-2rem,22rem)] flex-col gap-2 pointer-events-none px-4 md:px-0"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-xl backdrop-blur-sm ${
              t.variant === 'success'
                ? 'border-fo-green/40 bg-fo-graphite/95 text-zinc-100'
                : t.variant === 'error'
                  ? 'border-fo-red/50 bg-fo-graphite/95 text-zinc-100'
                  : 'border-fo-border bg-fo-graphite/95 text-zinc-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-fo-panel hover:text-white"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotify() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotify must be used within NotificationProvider')
  return ctx
}
