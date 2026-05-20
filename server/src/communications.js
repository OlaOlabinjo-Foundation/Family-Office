import { db } from './db.js';
import { logAudit } from './audit.js';
import { notifyCommunicationFollowUp } from './notifyMail.js';
import { resolveContactEmail } from './userEmails.js';

const CHANNELS = new Set(['email', 'phone', 'meeting', 'video', 'other']);
const NOTIFY_PARTIES = new Set(['a', 'b', 'both']);

function rowToComm(r) {
  return {
    id: r.id,
    loggedBy: r.logged_by,
    partyAName: r.party_a_name,
    partyBName: r.party_b_name,
    partyAEmail: r.party_a_email,
    partyBEmail: r.party_b_email,
    channel: r.channel,
    subject: r.subject,
    body: r.body,
    occurredAt: r.occurred_at,
    notifyParty: r.notify_party,
    createdAt: r.created_at,
  };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function listCommunications(database, { limit = 50, offset = 0 } = {}) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const total = database.prepare('SELECT COUNT(*) AS c FROM communications').get().c;
  const rows = database
    .prepare(`SELECT * FROM communications ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(lim, off);
  return { items: rows.map(rowToComm), total, limit: lim, offset: off };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function createCommunication(database, body, actor) {
  const partyAName = String(body.partyAName ?? body.party_a_name ?? '').trim();
  const partyBName = String(body.partyBName ?? body.party_b_name ?? '').trim();
  const partyAEmail = String(body.partyAEmail ?? body.party_a_email ?? '').trim() || null;
  const partyBEmail = String(body.partyBEmail ?? body.party_b_email ?? '').trim() || null;
  const channel = CHANNELS.has(body.channel) ? body.channel : 'email';
  const subject = String(body.subject || '').trim() || null;
  const commBody = String(body.body || '').trim();
  const occurredAt = String(body.occurredAt ?? body.occurred_at ?? '').trim().slice(0, 19) || new Date().toISOString().slice(0, 19);
  let notifyParty = String(body.notifyParty ?? body.notify_party ?? 'both').toLowerCase();
  if (!NOTIFY_PARTIES.has(notifyParty)) notifyParty = 'both';

  if (!partyAName || !partyBName) {
    return { ok: false, error: 'Both parties are required (Party A and Party B).' };
  }
  if (!commBody) {
    return { ok: false, error: 'Communication notes are required.' };
  }

  const resolvedA = partyAEmail || resolveContactEmail(partyAName, database);
  const resolvedB = partyBEmail || resolveContactEmail(partyBName, database);

  const info = database
    .prepare(
      `INSERT INTO communications (
        logged_by, party_a_name, party_b_name, party_a_email, party_b_email,
        channel, subject, body, occurred_at, notify_party
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      actor,
      partyAName,
      partyBName,
      resolvedA,
      resolvedB,
      channel,
      subject,
      commBody,
      occurredAt,
      notifyParty
    );

  const row = database.prepare('SELECT * FROM communications WHERE id = ?').get(info.lastInsertRowid);
  const item = rowToComm(row);

  logAudit(database, {
    actor,
    action: 'communication.create',
    entityType: 'communication',
    entityId: String(item.id),
    meta: {
      partyA: partyAName,
      partyB: partyBName,
      channel,
      notifyParty,
    },
  });

  return { ok: true, item };
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {ReturnType<typeof rowToComm>} item
 */
export async function sendCommunicationFollowUpEmails(database, item) {
  return notifyCommunicationFollowUp({
    id: item.id,
    loggedBy: item.loggedBy,
    partyAName: item.partyAName,
    partyBName: item.partyBName,
    partyAEmail: item.partyAEmail,
    partyBEmail: item.partyBEmail,
    channel: item.channel,
    subject: item.subject,
    body: item.body,
    occurredAt: item.occurredAt,
    notifyParty: item.notifyParty,
  });
}
