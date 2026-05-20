import { getCredentialStore } from './auth.js';

const JWT_SECRET = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';

/**
 * Refuses to start in production with demo credentials or missing JWT.
 * Call once before `app.listen`.
 */
export function assertProductionSafeConfig() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return;

  const store = getCredentialStore();
  if (store === 'demo') {
    console.error(
      '[FATAL] Demo authentication (*/demo) cannot run with NODE_ENV=production. Set FAMILY_OFFICE_AUTH=sqlite or FAMILY_OFFICE_USERS_JSON.'
    );
    process.exit(1);
  }

  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error(
      '[FATAL] JWT_SECRET must be set to a random string of at least 32 characters in production.'
    );
    process.exit(1);
  }

  if (store === 'sqlite' && !process.env.FAMILY_OFFICE_MFA_KEY?.trim()) {
    console.warn(
      '[warn] FAMILY_OFFICE_MFA_KEY is unset in production — TOTP secrets fall back to JWT_SECRET. Set a dedicated MFA encryption key.'
    );
  }
}
