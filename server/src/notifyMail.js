import { buildWeeklyDigestText } from './taskInbox.js';

/**
 * Optional SMTP notifications when env is set:
 * - `SMTP_URL` — connection string for nodemailer (e.g. `smtps://user:pass@smtp.example.com:465`)
 * - `SMTP_FROM` — From address
 * - `SMTP_TO` — recipient for import alerts
 */

/**
 * @param {{ filename: string, actor: string, approvedBy?: string | null, effectiveDate?: string | null }} detail
 */
export async function notifyImportSuccess(detail) {
  const smtpUrl = typeof process.env.SMTP_URL === 'string' ? process.env.SMTP_URL.trim() : '';
  if (!smtpUrl) return { sent: false, reason: 'no_smtp_url' };

  const from = typeof process.env.SMTP_FROM === 'string' ? process.env.SMTP_FROM.trim() : '';
  const to = typeof process.env.SMTP_TO === 'string' ? process.env.SMTP_TO.trim() : '';
  if (!from || !to) {
    console.warn('[mail] SMTP_URL is set but SMTP_FROM or SMTP_TO is missing; skipping send.');
    return { sent: false, reason: 'missing_from_or_to' };
  }

  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport(smtpUrl);
  const lines = [
    'Workbook import completed on the Family Office Command Centre.',
    '',
    `File: ${detail.filename}`,
    `Actor: ${detail.actor}`
  ];
  if (detail.approvedBy) lines.push(`Recorded approver: ${detail.approvedBy}`);
  if (detail.effectiveDate) lines.push(`Effective date (as recorded): ${detail.effectiveDate}`);
  lines.push('', `Time: ${new Date().toISOString()}`);

  await transporter.sendMail({
    from,
    to,
    subject: `[OOI Command Centre] Import success: ${detail.filename}`,
    text: lines.join('\n')
  });
  return { sent: true };
}

/**
 * @param {{ subject?: string; text: string; to?: string | string[] }} payload
 */
export async function sendMail(payload) {
  const smtpUrl = typeof process.env.SMTP_URL === 'string' ? process.env.SMTP_URL.trim() : '';
  if (!smtpUrl) return { sent: false, reason: 'no_smtp_url' };

  const from = typeof process.env.SMTP_FROM === 'string' ? process.env.SMTP_FROM.trim() : '';
  const toRaw =
    payload.to ||
    (typeof process.env.SMTP_DIGEST_TO === 'string' && process.env.SMTP_DIGEST_TO.trim()
      ? process.env.SMTP_DIGEST_TO.trim()
      : typeof process.env.SMTP_TO === 'string'
        ? process.env.SMTP_TO.trim()
        : '');
  if (!from || !toRaw) {
    console.warn('[mail] SMTP_URL set but SMTP_FROM or recipient missing.');
    return { sent: false, reason: 'missing_from_or_to' };
  }

  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport(smtpUrl);
  await transporter.sendMail({
    from,
    to: toRaw,
    subject: payload.subject || '[OOI Command Centre] Notification',
    text: payload.text,
  });
  return { sent: true, to: toRaw };
}

/**
 * @param {{ task: object; emails: string[]; baseUrl?: string; reason?: string }} detail
 */
export async function notifyTaskOwner({ task, emails, baseUrl = '', reason = 'new_task' }) {
  const list = [...new Set((emails || []).map((e) => String(e).trim()).filter(Boolean))];
  if (!list.length) return { sent: false, reason: 'no_recipients' };

  const base = baseUrl.replace(/\/$/, '');
  const link = (path) => (base ? `${base}${path}` : path);
  const lines = [
    'Ola Olabinjo Investment — Family Office task notification',
    '',
    reason === 'assigned' ? 'You have been assigned a task.' : 'A new task is assigned to you in the command centre.',
    '',
    `[${task.priority || 'P2'}] ${task.title}`,
    task.detail ? `  ${task.detail}` : '',
    `  Owner: ${task.owner || '—'}`,
    task.dueDate ? `  Due: ${task.dueDate}` : '',
    `  Source: ${task.source || 'Task inbox'}`,
    '',
    `Open: ${link(task.href || '/actions')}`,
    '',
    `Generated: ${new Date().toISOString()}`,
  ].filter(Boolean);

  return sendMail({
    to: list.join(', '),
    subject: `[OOI Command Centre] Task: ${task.title}`,
    text: lines.join('\n'),
  });
}

/**
 * @param {object} comm
 */
export async function notifyCommunicationFollowUp(comm) {
  const recipients = [];
  const party = String(comm.notifyParty || 'both').toLowerCase();
  if (party === 'a' || party === 'both') {
    const email = comm.partyAEmail;
    if (email) recipients.push({ email, name: comm.partyAName });
  }
  if (party === 'b' || party === 'both') {
    const email = comm.partyBEmail;
    if (email) recipients.push({ email, name: comm.partyBName });
  }

  const unique = [];
  const seen = new Set();
  for (const r of recipients) {
    const e = String(r.email || '').trim();
    if (!e || seen.has(e.toLowerCase())) continue;
    seen.add(e.toLowerCase());
    unique.push({ ...r, email: e });
  }
  if (!unique.length) return { sent: false, reason: 'no_recipient_email' };

  const subjectLine = comm.subject || 'Communication logged';
  const lines = [
    'Ola Olabinjo Investment — communication follow-up',
    '',
    'This is a follow-up record of a communication logged in the Family Office Command Centre.',
    '',
    `Logged by: ${comm.loggedBy}`,
    `When: ${comm.occurredAt}`,
    `Channel: ${comm.channel}`,
    `Parties: ${comm.partyAName} ↔ ${comm.partyBName}`,
    comm.subject ? `Subject: ${comm.subject}` : '',
    '',
    'Notes:',
    comm.body,
    '',
    `Reference ID: COMM-${comm.id}`,
    `Time sent: ${new Date().toISOString()}`,
  ].filter(Boolean);

  let sentAny = false;
  const mailed = [];
  for (const r of unique) {
    const result = await sendMail({
      to: r.email,
      subject: `[OOI Command Centre] Follow-up: ${subjectLine}`,
      text: [...lines, '', `Recipient: ${r.name}`].join('\n'),
    });
    if (result.sent) {
      sentAny = true;
      mailed.push(r.email);
    }
  }
  return sentAny ? { sent: true, to: mailed.join(', ') } : { sent: false, reason: 'send_failed' };
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {{ baseUrl?: string }} [opts]
 */
export async function notifyWeeklyDigest(database, opts = {}) {
  const baseUrl =
    opts.baseUrl ||
    (typeof process.env.DIGEST_APP_BASE_URL === 'string' ? process.env.DIGEST_APP_BASE_URL.trim() : '') ||
    (typeof process.env.APP_BASE_URL === 'string' ? process.env.APP_BASE_URL.trim() : '');
  const text = buildWeeklyDigestText(database, baseUrl);
  return sendMail({
    subject: '[OOI Command Centre] Weekly task digest',
    text,
  });
}
