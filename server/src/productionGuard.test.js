import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('assertProductionSafeConfig', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = envBackup;
    vi.restoreAllMocks();
  });

  it('does not exit in development with demo auth', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.FAMILY_OFFICE_AUTH;
    delete process.env.FAMILY_OFFICE_USERS_JSON;
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const { assertProductionSafeConfig } = await import('./productionGuard.js');
    assertProductionSafeConfig();
    expect(exit).not.toHaveBeenCalled();
  });

  it('exits in production when credential store is demo', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FAMILY_OFFICE_AUTH;
    delete process.env.FAMILY_OFFICE_USERS_JSON;
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const { assertProductionSafeConfig } = await import('./productionGuard.js');
    assertProductionSafeConfig();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits in production without JWT_SECRET', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FAMILY_OFFICE_AUTH = 'sqlite';
    delete process.env.JWT_SECRET;
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const { assertProductionSafeConfig } = await import('./productionGuard.js');
    assertProductionSafeConfig();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
