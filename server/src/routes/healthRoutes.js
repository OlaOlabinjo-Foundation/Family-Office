import { Router } from 'express';
import fs from 'fs';
import { getCredentialStore } from '../auth.js';
import { getDatabaseFilePath } from '../db.js';
import { getVaultRoot } from '../documentVault.js';
import { sessionCookieEnabled } from '../middleware/sessionCookie.js';

/**
 * @param {{ version: string }} deps
 */
export function createHealthRouter({ version }) {
  const router = Router();

  router.get('/api/health', (_req, res) => {
    const credentialStore = getCredentialStore();
    const dbPath = getDatabaseFilePath();
    const dbOnDisk = dbPath && dbPath !== ':memory:' && fs.existsSync(dbPath);
    let vaultFileCount = null;
    try {
      const vaultRoot = getVaultRoot();
      if (fs.existsSync(vaultRoot)) {
        vaultFileCount = fs.readdirSync(vaultRoot, { withFileTypes: true }).filter((d) => d.isFile()).length;
      }
    } catch {
      vaultFileCount = null;
    }

    res.json({
      ok: true,
      service: 'ola-olabinjo-command-centre',
      version,
      time: new Date().toISOString(),
      runtime: {
        node: process.version,
        env: process.env.NODE_ENV || 'development',
      },
      storage: {
        database: dbOnDisk ? dbPath : dbPath === ':memory:' ? ':memory:' : 'missing',
        databaseReady: dbOnDisk || dbPath === ':memory:',
        vaultRoot: getVaultRoot(),
        vaultFileCount,
      },
      auth: {
        mode: process.env.JWT_SECRET ? 'jwt-hs256' : 'legacy-mock',
        sessionSigned: Boolean(process.env.JWT_SECRET),
        sessionCookie: sessionCookieEnabled(),
        credentialStore,
        userSource: credentialStore === 'demo' ? 'demo' : 'configured',
      },
    });
  });

  return router;
}
