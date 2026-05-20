import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Default path to the operational master workbook (Windows filename as shipped). */
export const DEFAULT_MASTER_XLSX = path.resolve(
  path.join(__dirname, '../../'),
  'Ola Olabinjo Family Office Command Centre Board Ready.xlsx NEwest.xlsx'
);

export const MASTER_XLSX_PATH = process.env.MASTER_XLSX_PATH || DEFAULT_MASTER_XLSX;

export const PORT = Number(process.env.PORT || 8787);

/** How many NGN for 1 unit of foreign currency (indicative book conversion for dashboards). Override via env. */
function parsePositiveRate(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const FX_NGN_PER_USD = parsePositiveRate('FX_NGN_PER_USD', 1600);
export const FX_NGN_PER_GBP = parsePositiveRate('FX_NGN_PER_GBP', 2050);
export const FX_NGN_PER_EUR = parsePositiveRate('FX_NGN_PER_EUR', 1750);
