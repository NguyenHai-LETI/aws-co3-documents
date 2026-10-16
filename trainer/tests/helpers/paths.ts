// Locations used by the e2e / UI tests (no server modules imported, so env overrides stay untouched).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** trainer/ (code + the real data the sandbox is copied from). */
export const TRAINER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Repository root (notes, .gitattributes). */
export const REPO_ROOT = path.resolve(TRAINER_ROOT, '..');
