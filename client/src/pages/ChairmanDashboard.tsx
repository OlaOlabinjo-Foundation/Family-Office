import { useEffect, useState } from 'react'
import { ChairmanExecutiveView } from '../components/chairman/ChairmanExecutiveView'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { downloadChairmanBoardPackPdf } from '../lib/chairmanBoardPackPdf'
import type { ChairmanExecutiveData } from '../lib/chairmanExecutive'
import { setDocumentTitle } from '../lib/documentTitle'

export function ChairmanDashboard() {
  const { token } = useAuth()
  const { show: notify } = useNotify()
  const [data, setData] = useState<ChairmanExecutiveData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    setDocumentTitle('Family overview')
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const s = await apiFetch<ChairmanExecutiveData>('/api/dashboard/summary', { token })
        if (!c) setData(s)
      } catch (e) {
        if (!c) setErr((e as Error).message)
      }
    })()
    return () => {
      c = true
    }
  }, [token])

  function handleDownloadPdf() {
    if (!data) return
    setPdfBusy(true)
    void downloadChairmanBoardPackPdf(data)
      .then(() => notify('Principal overview PDF downloaded', 'success'))
      .catch((e) => notify((e as Error).message || 'PDF export failed', 'error'))
      .finally(() => setPdfBusy(false))
  }

  if (err) {
    return (
      <div className="chairman-executive-shell w-full min-w-0 px-4 py-8 sm:px-6 lg:px-8">
        <p role="alert" className="text-sm text-fo-red">
          {err}
        </p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="chairman-executive-shell w-full min-w-0 px-4 py-12 sm:px-6 lg:px-8">
        <LoadingBlock label="Preparing your overview…" />
      </div>
    )
  }

  return (
    <article className="w-full min-w-0 print:text-zinc-900">
      <ChairmanExecutiveView data={data} onDownloadPdf={handleDownloadPdf} pdfBusy={pdfBusy} />
    </article>
  )
}
