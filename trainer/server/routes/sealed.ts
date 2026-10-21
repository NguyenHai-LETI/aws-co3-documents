// [γ] Sealed forms routes — never any question id:
//   GET  /api/sealed                         → SealedStatus {forms: SealedFormSummary[], size, file?, sealed}
//   POST /api/sealed/release {form: "S1"}    → SealedStatus + {released}   ("Mở sớm": its questions return to practice)
//   POST /api/sealed/create {forms?, size?}  → SealedStatus + {created, notes?}   (only while no form is sealed)
// Errors: 400 missing form · 404 unknown form · 409 form not sealed / a form still sealed / unreadable file · 422 bank too small.
import { HttpError, readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { scheduleSnapshot } from '../lib/snapshot.ts';
import { SealedError, createForms, releaseForm, sealedStatus } from '../lib/sealed.ts';
import type { SealedStatus } from '../../shared/types.ts';

/** SealedError → the HTTP status it carries (anything else stays a 500). */
function guard<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof SealedError) throw new HttpError(e.status, e.message);
    throw e;
  }
}

const count = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));

route('GET', '/api/sealed', (): SealedStatus => sealedStatus());

route('POST', '/api/sealed/release', async (req): Promise<SealedStatus> => {
  const body = await readBody<{ form?: unknown }>(req);
  const form = guard(() => releaseForm(typeof body.form === 'string' ? body.form : '')).id;
  scheduleSnapshot(); // the coach snapshot lists the forms
  return { ...sealedStatus(), released: form };
});

route('POST', '/api/sealed/create', async (req): Promise<SealedStatus> => {
  const body = await readBody<{ forms?: unknown; size?: unknown }>(req);
  const forms = count(body.forms);
  const size = count(body.size);
  if ((forms !== undefined && !Number.isFinite(forms)) || (size !== undefined && !Number.isFinite(size))) throw new HttpError(400, 'forms / size phải là số');
  const { bank, attempts, cfg } = context();
  const r = guard(() => createForms(bank, attempts, cfg, { forms, size }));
  scheduleSnapshot();
  return { ...sealedStatus(), created: r.created, ...(r.notes.length ? { notes: r.notes } : {}) };
});
