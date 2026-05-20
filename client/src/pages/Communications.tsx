import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { setDocumentTitle } from '../lib/documentTitle'

type CommItem = {
  id: number
  loggedBy: string
  partyAName: string
  partyBName: string
  partyAEmail: string | null
  partyBEmail: string | null
  channel: string
  subject: string | null
  body: string
  occurredAt: string
  notifyParty: string
  createdAt: string
}

const CHANNELS = ['email', 'phone', 'meeting', 'video', 'other'] as const
const NOTIFY = [
  { id: 'both', label: 'Both parties' },
  { id: 'a', label: 'Party A only' },
  { id: 'b', label: 'Party B only' },
] as const

export function Communications() {
  const { token, canWrite } = useAuth()
  const { show: notify } = useNotify()
  const [items, setItems] = useState<CommItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [partyA, setPartyA] = useState('')
  const [partyB, setPartyB] = useState('')
  const [emailA, setEmailA] = useState('')
  const [emailB, setEmailB] = useState('')
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('email')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [notifyParty, setNotifyParty] = useState<'a' | 'b' | 'both'>('both')

  const load = useCallback(async () => {
    const r = await apiFetch<{ items: CommItem[] }>('/api/communications', { token })
    setItems(r.items)
  }, [token])

  useEffect(() => {
    setDocumentTitle('Communications')
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        await load()
      } catch (e) {
        if (!c) setErr((e as Error).message)
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canWrite) return
    setBusy(true)
    try {
      const r = await apiFetch<{ item: CommItem; mail: { sent: boolean; reason?: string } }>('/api/communications', {
        method: 'POST',
        token,
        body: JSON.stringify({
          partyAName: partyA.trim(),
          partyBName: partyB.trim(),
          partyAEmail: emailA.trim() || undefined,
          partyBEmail: emailB.trim() || undefined,
          channel,
          subject: subject.trim() || undefined,
          body: body.trim(),
          occurredAt,
          notifyParty,
        }),
      })
      setPartyA('')
      setPartyB('')
      setEmailA('')
      setEmailB('')
      setSubject('')
      setBody('')
      setOccurredAt(new Date().toISOString().slice(0, 16))
      await load()
      if (r.mail.sent) {
        notify('Communication logged and follow-up email sent.', 'success')
      } else {
        notify(
          'Communication logged. Follow-up email was not sent — add party emails or configure SMTP on the server.',
          'info'
        )
      }
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Communications log"
        description="Record calls, emails, and meetings. A follow-up email is sent to the selected party when SMTP and email addresses are configured."
      />

      {canWrite ? (
        <form onSubmit={submit} className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 md:p-6 space-y-4 max-w-2xl">
          <h2 className="text-sm font-medium text-white">Log communication</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Party A (name or username)</label>
              <input
                value={partyA}
                onChange={(e) => setPartyA(e.target.value)}
                required
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Party B</label>
              <input
                value={partyB}
                onChange={(e) => setPartyB(e.target.value)}
                required
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Party A email (optional)</label>
              <input
                type="email"
                value={emailA}
                onChange={(e) => setEmailA(e.target.value)}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Party B email (optional)</label>
              <input
                type="email"
                value={emailB}
                onChange={(e) => setEmailB(e.target.value)}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">When</label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Notes</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
            />
          </div>
          <div>
            <span className="mb-2 block text-xs text-zinc-500">Send follow-up email to</span>
            <div className="flex flex-wrap gap-2">
              {NOTIFY.map((n) => (
                <label key={n.id} className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="radio"
                    name="notifyParty"
                    checked={notifyParty === n.id}
                    onChange={() => setNotifyParty(n.id)}
                  />
                  {n.label}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Log & send follow-up'}
          </button>
        </form>
      ) : null}

      <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 md:p-6">
        <h2 className="text-sm font-medium text-white mb-4">Recent communications</h2>
        {loading ? <p className="text-sm text-zinc-500">Loading…</p> : null}
        {err ? <p className="text-sm text-fo-red">{err}</p> : null}
        {!loading && !items.length ? <p className="text-sm text-zinc-500">No communications logged yet.</p> : null}
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="rounded-lg border border-fo-border bg-fo-panel/40 p-4 text-sm">
              <p className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mb-1">
                <span>{c.occurredAt.replace('T', ' ')}</span>
                <span>·</span>
                <span className="uppercase">{c.channel}</span>
                <span>·</span>
                <span>by {c.loggedBy}</span>
              </p>
              <p className="text-white font-medium">
                {c.partyAName} ↔ {c.partyBName}
              </p>
              {c.subject ? <p className="text-zinc-400 mt-1">{c.subject}</p> : null}
              <p className="text-zinc-500 mt-2 whitespace-pre-wrap line-clamp-3">{c.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
