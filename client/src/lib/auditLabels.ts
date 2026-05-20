export type AuditRow = {
  id: number
  actor: string
  action: string
  entity_type: string | null
  entity_id: string | null
  created_at: string
  meta: Record<string, unknown> | null
}

const ACTION_LABELS: Record<string, string> = {
  'data.create': 'Row created',
  'data.update': 'Row updated',
  'data.delete': 'Row deleted',
  'data.soft_delete': 'Row archived',
  'data.restore': 'Row restored',
  'change_request.submit': 'Change submitted for approval',
  'change_request.approve': 'Change approved',
  'change_request.reject': 'Change rejected',
  'compliance_calendar.create': 'Calendar item created',
  'compliance_calendar.update': 'Calendar item updated',
  'compliance_calendar.complete': 'Calendar item completed',
  'compliance_calendar.reopen': 'Calendar item reopened',
  'compliance_calendar.delete': 'Calendar item deleted',
  'documents.review_set': 'Marked reviewed (portal)',
  'documents.review_clear': 'Review mark cleared',
  'vault.upload': 'Vault file uploaded',
  'vault.delete': 'Vault file removed',
  'import.confirm': 'Workbook import applied',
  'import.preview': 'Import previewed',
  'snapshot.capture': 'Portfolio snapshot captured',
  'decision.resolve': 'Decision resolved',
  'decision.reopen': 'Decision reopened',
  'auth.password_change': 'Password changed',
  'auth.mfa_setup_started': 'MFA setup started',
  'auth.mfa_enabled': 'Two-factor authentication enabled',
  'auth.mfa_disabled': 'Two-factor authentication disabled',
  'auth.mfa_login': 'Signed in with MFA',
  'admin.app_user.create': 'User account created',
  'admin.app_user.update': 'User account updated',
  'admin.app_user.delete': 'User account removed',
  'digest.send': 'Weekly digest email sent',
  'communication.create': 'Communication logged',
  'assigned_task.create': 'Task assigned',
  'assigned_task.complete': 'Assigned task completed',
}

export function formatAuditAction(action: string): string {
  const key = (action || '').trim()
  if (ACTION_LABELS[key]) return ACTION_LABELS[key]
  return key.replace(/\./g, ' · ').replace(/_/g, ' ')
}

export function formatAuditMetaSummary(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null
  const note = typeof meta.note === 'string' && meta.note.trim() ? meta.note.trim() : null
  const fields = meta.fields
  if (Array.isArray(fields) && fields.length) {
    const fieldList = fields.map(String).join(', ')
    return note ? `${fieldList} — ${note}` : `Fields: ${fieldList}`
  }
  const keys = meta.keys
  if (Array.isArray(keys) && keys.length) {
    return `Initial fields: ${keys.map(String).join(', ')}`
  }
  if (note) return note
  const changed = meta.changed
  if (Array.isArray(changed) && changed.length) {
    return `Changed: ${changed.map(String).join(', ')}`
  }
  return null
}

export function formatAuditTimestamp(iso: string): string {
  if (!iso) return '—'
  return String(iso).replace('T', ' ').slice(0, 19)
}
