#!/usr/bin/env node
/**
 * Verify a hosted API (or Vercel proxy) responds on /api/health.
 *
 *   node scripts/check-live-api.mjs https://your-app.onrender.com
 *   COMMAND_CENTRE_API_URL=https://your-app.vercel.app node scripts/check-live-api.mjs
 */
const base = (process.argv[2] || process.env.COMMAND_CENTRE_API_URL || '').replace(/\/$/, '');
if (!base) {
  console.error('Usage: node scripts/check-live-api.mjs <API-or-Vercel-URL>');
  console.error('Example: node scripts/check-live-api.mjs https://ooi-family-office.onrender.com');
  process.exit(1);
}

const url = `${base}/api/health`;
console.log(`GET ${url}`);

const res = await fetch(url);
const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  console.error('Not JSON — is the API running? First 300 chars:\n', text.slice(0, 300));
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
if (!res.ok || body.ok === false) {
  console.error(`\nFAIL (${res.status})`);
  process.exit(1);
}
console.log('\nOK — use this URL as COMMAND_CENTRE_API_URL on Vercel (no trailing slash).');
