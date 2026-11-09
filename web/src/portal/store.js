// Offline-first data for the sales portal.
// Everything an agent records is saved on the phone first, then sent to Pentarch when there is internet.
const K = { session: 'pp_session', leads: 'pp_leads', outbox: 'pp_outbox', cache: 'pp_cache' };
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let session = read(K.session, null);
const listeners = new Set();
const emit = () => listeners.forEach(f => f());
export const subscribe = f => { listeners.add(f); return () => listeners.delete(f); };

export const getSession = () => session;
export function setSession(s) {
  session = s; write(K.session, s);
  if (!s) { write(K.leads, null); write(K.outbox, null); write(K.cache, null); }
  emit();
}

export class ApiError extends Error { constructor(m, status) { super(m); this.status = status; } }
export async function call(method, url, body) {
  let res;
  try {
    res = await fetch('/api/public' + url, { method, headers: { 'content-type': 'application/json', 'x-portal': session?.token || '' }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError('No internet connection. Your work is saved on this phone and will be sent when you are back online.', 0); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && session && !url.endsWith('/login')) { setSession(null); }
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status);
  return data;
}
export const get = url => call('GET', url);
export const post = (url, body) => call('POST', url, body || {});

// ---------- cached server data (so screens work offline) ----------
export const cache = (k, v) => { const c = read(K.cache, {}); if (v === undefined) return c[k]; c[k] = v; write(K.cache, c); };

// ---------- leads ----------
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const nowIso = () => new Date().toISOString();
export function leads() {
  const map = read(K.leads, {});
  const box = outbox();
  for (const [u, l] of Object.entries(box.leads)) map[u] = { ...(map[u] || {}), ...l, _pending: true };
  for (const a of box.activities) if (map[a.lead_uid]) { map[a.lead_uid].activities = [{ ...a, _pending: true }, ...(map[a.lead_uid].activities || []).filter(x => x.uid !== a.uid)]; map[a.lead_uid]._pending = true; }
  return Object.values(map).sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
}
export const lead = u => leads().find(l => l.uid === u);
export function outbox() { return read(K.outbox, { leads: {}, activities: [] }); }
export const pendingCount = () => { const b = outbox(); return Object.keys(b.leads).length + b.activities.length; };

export function saveLead(l) {
  const b = outbox();
  const isNew = !l.uid;
  const rec = { ...l, uid: l.uid || uid(), updated_at: nowIso(), created_at: l.created_at || nowIso() };
  delete rec._pending; delete rec.activities; delete rec.demo;
  b.leads[rec.uid] = rec;
  if (isNew) b.activities.push({ uid: uid(), lead_uid: rec.uid, kind: 'created', note: 'Client added', at: nowIso() });
  write(K.outbox, b); emit(); sync();
  return rec;
}
export function logActivity(lead_uid, kind, note) {
  const b = outbox();
  b.activities.push({ uid: uid(), lead_uid, kind, note, at: nowIso() });
  write(K.outbox, b); emit(); sync();
}
export function mergeServer(rows) {
  const map = {};
  for (const r of rows) map[r.uid] = r;
  write(K.leads, map); emit();
}
export function putServerLead(r) { const map = read(K.leads, {}); map[r.uid] = r; write(K.leads, map); emit(); }

// ---------- sync ----------
let syncing = null;
export const syncState = { last: read('pp_last_sync', null), error: null, busy: false };
export function sync() {
  if (!session) return Promise.resolve();
  if (syncing) return syncing;
  syncState.busy = true; emit();
  syncing = (async () => {
    try {
      const box = outbox();
      const sentLeads = Object.values(box.leads), sentActs = box.activities;
      if (sentLeads.length || sentActs.length) {
        await post('/portal/sync', { leads: sentLeads, activities: sentActs });
        // remove only what was sent (more may have been added meanwhile)
        const now = outbox();
        for (const l of sentLeads) if (now.leads[l.uid]?.updated_at === l.updated_at) delete now.leads[l.uid];
        now.activities = now.activities.filter(a => !sentActs.some(s => s.uid === a.uid));
        write(K.outbox, now);
      }
      mergeServer(await get('/portal/leads'));
      syncState.last = new Date().toISOString(); write('pp_last_sync', syncState.last);
      syncState.error = null;
    } catch (e) { syncState.error = e.status === 0 ? 'offline' : e.message; }
    finally { syncState.busy = false; syncing = null; emit(); }
  })();
  return syncing;
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => sync());
  setInterval(() => { if (navigator.onLine) sync(); }, 90e3);
}
