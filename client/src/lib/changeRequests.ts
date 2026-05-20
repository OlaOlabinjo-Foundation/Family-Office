import { apiFetch } from './api'

export type ChangeRequest = {
  id: number
  table: string
  operation: 'create' | 'update' | 'archive'
  rowId: number | null
  payload: Record<string, unknown>
  status: string
  submittedBy: string
  submittedAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewComment: string | null
  summary: string
}

export async function submitChangeRequest(
  token: string | null,
  input: {
    table: string
    operation: 'create' | 'update' | 'archive'
    rowId?: number
    payload?: Record<string, unknown>
  }
) {
  return apiFetch<ChangeRequest>('/api/change-requests', {
    method: 'POST',
    token,
    body: JSON.stringify({
      table: input.table,
      operation: input.operation,
      rowId: input.rowId,
      payload: input.payload ?? {},
    }),
  })
}
