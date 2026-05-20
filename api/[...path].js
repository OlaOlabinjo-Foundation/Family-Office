/**
 * Vercel serverless proxy: forwards /api/* to the hosted Command Centre API.
 * Set COMMAND_CENTRE_API_URL in Vercel (e.g. https://your-app.onrender.com).
 */
export default async function handler(req, res) {
  const base = typeof process.env.COMMAND_CENTRE_API_URL === 'string' ? process.env.COMMAND_CENTRE_API_URL.trim() : '';
  if (!base) {
    return res.status(503).json({
      ok: false,
      error: 'COMMAND_CENTRE_API_URL is not set on Vercel.',
      hint: 'Deploy the API (see README → Going live), then add COMMAND_CENTRE_API_URL to Vercel Environment Variables.',
    });
  }

  const segments = req.query.path;
  const subpath = Array.isArray(segments) ? segments.join('/') : segments || '';
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue;
    if (Array.isArray(value)) value.forEach((v) => q.append(key, v));
    else if (value != null) q.append(key, String(value));
  }
  const qs = q.toString() ? `?${q.toString()}` : '';
  const target = `${base.replace(/\/$/, '')}/api/${subpath}${qs}`;

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const k = key.toLowerCase();
    if (k === 'host' || k === 'connection' || k === 'content-length') continue;
    headers[key] = Array.isArray(value) ? value[0] : value;
  }

  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.body !== undefined && req.body !== null) {
      init.body = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
      if (!headers['content-type'] && !headers['Content-Type']) {
        headers['content-type'] = 'application/json';
      }
    }
  }

  try {
    const upstream = await fetch(target, init);
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.send(buf);
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: 'Could not reach the command centre API.',
      detail: e instanceof Error ? e.message : String(e),
      target,
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '26mb',
    },
  },
};
