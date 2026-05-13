import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'

type Rec = {
  id: string
  headline: string
  body: string
  priority: string
  category: string
  confidence: number
}

export function NextActions() {
  const { token } = useAuth()
  const reduceMotion = useReducedMotion()
  const [items, setItems] = useState<Rec[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const r = await apiFetch<{ items: Rec[] }>('/api/recommendations', { token })
        if (!c) setItems(r.items)
      } catch (e) {
        if (!c) setErr((e as Error).message)
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [token])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advisory"
        title="Next best actions"
        description="Executive-style prompts synthesised from portfolio telemetry — designed to read like a trusted family office advisor, not an analyst workbook."
      />

      {err ? (
        <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {err}
        </div>
      ) : null}
      {loading ? <LoadingBlock label="Loading recommendations…" /> : null}

      {!loading && !err ? (
        <>
          {!items.length ? (
            <p className="rounded-lg border border-fo-border bg-fo-graphite/30 px-4 py-6 text-sm text-zinc-500">
              No recommendations available for the current book.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : i * 0.03 }}
                  className="rounded-2xl border border-fo-border bg-gradient-to-br from-fo-graphite to-fo-black p-5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-fo-gold">{r.category}</span>
                    <span className="text-[10px] text-zinc-500">{r.priority}</span>
                  </div>
                  <h2 className="mt-2 text-lg text-white">{r.headline}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{r.body}</p>
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-fo-panel">
                    <div className="h-full bg-fo-gold" style={{ width: `${Math.round((r.confidence || 0) * 100)}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-600">Model confidence {Math.round((r.confidence || 0) * 100)}%</div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
