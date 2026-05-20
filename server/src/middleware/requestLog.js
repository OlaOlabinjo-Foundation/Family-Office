import crypto from 'crypto';

/** @param {import('express').Express} app */
export function applyRequestLogging(app) {
  app.use((req, res, next) => {
    const requestId = crypto.randomBytes(8).toString('hex');
    req.requestId = requestId;
    const start = Date.now();

    res.on('finish', () => {
      if (req.path.startsWith('/api/health')) return;
      const ms = Date.now() - start;
      const user = req.user?.username || '-';
      const line = JSON.stringify({
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms,
        user,
      });
      if (res.statusCode >= 500) console.error(line);
      else if (res.statusCode >= 400) console.warn(line);
      else console.log(line);
    });

    next();
  });
}
