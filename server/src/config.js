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
