import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { isReportSlug, reportPath, type ReportSlug } from '../lib/reportsCatalog'

export function useReportFromUrl(token: string | null | undefined) {
  const { slug: slugParam } = useParams<{ slug?: string }>()
  const navigate = useNavigate()
  const [last, setLast] = useState<Record<string, unknown> | null>(null)
  const [lastSlug, setLastSlug] = useState<ReportSlug | null>(null)
  const [reportBusy, setReportBusy] = useState<string | null>(null)
  const [reportErr, setReportErr] = useState<string | null>(null)
  const loadRef = useRef(0)

  const urlSlug = isReportSlug(slugParam) ? slugParam : null
  const invalidSlug = !!slugParam && !isReportSlug(slugParam)

  const closeReport = useCallback(() => {
    navigate('/reports')
  }, [navigate])

  const openReport = useCallback(
    (slug: ReportSlug) => {
      navigate(reportPath(slug))
    },
    [navigate],
  )

  useEffect(() => {
    if (!urlSlug || !token) {
      if (!urlSlug) {
        setLast(null)
        setLastSlug(null)
        if (!invalidSlug) setReportErr(null)
      }
      return
    }

    const id = ++loadRef.current
    setReportErr(null)
    setReportBusy(urlSlug)
    void (async () => {
      try {
        const data = await apiFetch<Record<string, unknown>>(`/api/reports/${urlSlug}`, { token })
        if (id !== loadRef.current) return
        setLast(data)
        setLastSlug(urlSlug)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch (e) {
        if (id !== loadRef.current) return
        setReportErr((e as Error).message)
        setLast(null)
        setLastSlug(null)
      } finally {
        if (id === loadRef.current) setReportBusy(null)
      }
    })()
  }, [urlSlug, token, invalidSlug])

  return {
    urlSlug,
    invalidSlug,
    last,
    lastSlug,
    reportBusy,
    reportErr,
    openReport,
    closeReport,
    isDetailView: !!urlSlug,
  }
}
