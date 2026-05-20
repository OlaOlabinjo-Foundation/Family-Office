import { db } from './db.js';
import { computeDashboard } from './intelligence.js';
import { isOutstandingDocumentRow } from './documentFilters.js';
import { countPendingChangeRequests } from './changeRequests.js';
import { countOverdueCalendarItems } from './complianceCalendar.js';
import { listOpenAssignedTasks } from './assignedTasks.js';

const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };

function priorityRank(p) {
  return PRIORITY_RANK[String(p || 'P2').toUpperCase()] ?? 3;
}

function sortTasks(items) {
  return [...items].sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    const da = a.dueDate || '9999-99-99';
    const db_ = b.dueDate || '9999-99-99';
    if (da !== db_) return da.localeCompare(db_);
    return String(a.title).localeCompare(String(b.title));
  });
}

/**
 * Unified operator task list: open decisions, compliance verification, data-quality actions.
 * @param {import('better-sqlite3').Database} [database]
 */
export function buildTaskInbox(database = db) {
  const dash = computeDashboard(database);
  const now = new Date();
  const openDecisionIds = new Set(
    (dash.decisions || []).filter((d) => d.status === 'open').map((d) => d.id)
  );

  const items = [];

  for (const d of dash.decisions || []) {
    if (d.status !== 'open') continue;
    items.push({
      id: `task-decision-${d.id}`,
      kind: 'decision',
      priority: d.priority || 'P2',
      title: d.title,
      detail: d.recommendation,
      owner: d.owner || '—',
      dueDate: d.dueDate || null,
      href: `/decisions?focus=${encodeURIComponent(d.id)}`,
      source: d.source || 'Decision engine',
      decisionId: d.id,
      canResolve: true,
    });
  }

  const docs = database.prepare('SELECT * FROM documents').all();
  for (const doc of docs) {
    if (!(doc.document_category || doc.entity_asset)) continue;
    if (!isOutstandingDocumentRow(doc)) continue;
    const decId = `DEC-DOC-${doc.id}`;
    if (openDecisionIds.has(decId)) continue;
    items.push({
      id: `task-compliance-${doc.id}`,
      kind: 'compliance',
      priority: 'P2',
      title: `Verify document: ${doc.document_category || 'General'}`,
      detail: `${doc.entity_asset || '—'} · status: ${doc.status || '—'}`,
      owner: doc.owner || 'Analyst',
      dueDate: null,
      href: `/documents?outstanding=1&highlight=${doc.id}`,
      source: 'Document tracker',
      documentId: doc.id,
      needsPortalReview: !doc.reviewed_at,
    });
  }

  const pendingApprovals = countPendingChangeRequests(database);
  const overdueCalendar = countOverdueCalendarItems(database);
  if (overdueCalendar > 0) {
    items.push({
      id: 'task-calendar-overdue',
      kind: 'compliance',
      priority: 'P1',
      title: `${overdueCalendar} compliance calendar item${overdueCalendar === 1 ? '' : 's'} overdue`,
      detail: 'Filings, KYC refresh, or attestations past due date.',
      owner: 'Lead / Analyst',
      dueDate: null,
      href: '/compliance/calendar?view=overdue',
      source: 'Compliance calendar',
    });
  }
  if (pendingApprovals > 0) {
    items.push({
      id: 'task-approval-queue',
      kind: 'approval',
      priority: 'P1',
      title: `${pendingApprovals} register change${pendingApprovals === 1 ? '' : 's'} awaiting approval`,
      detail: 'Analyst-submitted master or cash updates need lead sign-off before they apply to the book.',
      owner: 'Lead',
      dueDate: null,
      href: '/approvals',
      source: 'Approval queue',
    });
  }

  for (const t of listOpenAssignedTasks(database)) {
    items.push({
      id: `task-assigned-${t.id}`,
      kind: 'assigned',
      priority: t.priority || 'P2',
      title: t.title,
      detail: t.detail || 'Assigned task',
      owner: t.owner,
      dueDate: t.dueDate || null,
      href: `/actions?focus=task-assigned-${t.id}`,
      source: 'Assigned tasks',
      assignedTaskId: t.id,
    });
  }

  for (const q of dash.dataQuality?.items || []) {
    items.push({
      id: `task-dq-${q.id}`,
      kind: 'data_quality',
      priority: q.severity === 'high' ? 'P1' : 'P2',
      title: q.label,
      detail: `${q.count} item${q.count === 1 ? '' : 's'} flagged on the book`,
      owner: 'Lead / Analyst',
      dueDate: null,
      href: q.href,
      source: 'Data quality',
      count: q.count,
    });
  }

  const sorted = sortTasks(items);
  const byKind = { decision: 0, compliance: 0, data_quality: 0, approval: 0, assigned: 0 };
  for (const t of sorted) {
    if (t.kind in byKind) byKind[t.kind]++;
  }

  return {
    generatedAt: now.toISOString(),
    summary: {
      total: sorted.length,
      openDecisions: dash.pendingDecisions ?? byKind.decision,
      outstandingDocs: dash.outstandingDocumentation ?? 0,
      byKind,
    },
    items: sorted,
  };
}

/**
 * Plain-text weekly digest for email.
 * @param {import('better-sqlite3').Database} database
 * @param {string} baseUrl
 */
export function buildWeeklyDigestText(database, baseUrl = '') {
  const inbox = buildTaskInbox(database);
  const base = baseUrl.replace(/\/$/, '');
  const link = (path) => (base ? `${base}${path}` : path);

  const lines = [
    'Ola Olabinjo Investment — Family Office weekly digest',
    `Generated: ${inbox.generatedAt}`,
    '',
    `Open tasks: ${inbox.summary.total}`,
    `  · Decisions: ${inbox.summary.byKind.decision}`,
    `  · Compliance verification: ${inbox.summary.byKind.compliance}`,
    `  · Data quality: ${inbox.summary.byKind.data_quality}`,
    `Outstanding documents (workbook): ${inbox.summary.outstandingDocs}`,
    '',
    'Top priorities',
    '',
  ];

  const top = inbox.items.slice(0, 12);
  if (!top.length) {
    lines.push('No open tasks — book checks are clear.');
  } else {
    for (const t of top) {
      lines.push(`[${t.priority}] ${t.title}`);
      lines.push(`  ${t.detail}`);
      lines.push(`  Owner: ${t.owner} · ${link(t.href)}`);
      lines.push('');
    }
  }

  lines.push('—');
  lines.push(`Task inbox: ${link('/actions')}`);
  lines.push(`Command centre: ${link('/')}`);
  lines.push(`Compliance: ${link('/documents?outstanding=1')}`);
  return lines.join('\n');
}
