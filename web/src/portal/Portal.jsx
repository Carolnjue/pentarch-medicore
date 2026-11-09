import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Logo from './Logo';
import * as S from './store';
import { LOGO, SITE, PHONE, PHONE_WA, EMAIL, COUNTIES, TYPES, typeLabel, STAGES, stage, ACTS, ROLES, LOST, KES, fmtDate, ago, todayStr, addDays, waLink, telLink } from './data';

// re-render whenever local data or sync state changes
let tick = 0;
S.subscribe(() => { tick++; });
const useStore = () => useSyncExternalStore(S.subscribe, () => tick);

const I = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  plus: 'M12 5v14M5 12h14',
  cash: 'M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v4M18 10v4',
  more: 'M4 6h16M4 12h16M4 18h16',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  wa: 'M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.6zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.2-.5-2.4-1.7-2.9-2.9l1-1-1-2-1.6 1z',
  back: 'M15 18l-6-6 6-6',
  pin: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  sync: 'M21 12a9 9 0 0 1-15.4 6.4L3 16M3 12a9 9 0 0 1 15.4-6.4L21 8M21 3v5h-5M3 21v-5h5',
  check: 'M20 6L9 17l-5-5',
  key: 'M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7z',
  play: 'M6 4l14 8-14 8z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
};
const Icon = ({ n, s = 20 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={I[n]} /></svg>;

function useAsync(fn, deps = []) {
  const [st, set] = useState({ data: undefined, error: null, loading: true });
  const run = () => { set(s => ({ ...s, loading: true })); return fn().then(data => set({ data, error: null, loading: false }), error => set(s => ({ ...s, error, loading: false }))); };
  useEffect(() => { run(); }, deps);
  return { ...st, reload: run };
}
// fetch, falling back to the last copy saved on the phone
function useCached(key, url, deps = []) {
  return useAsync(async () => {
    try { const d = await S.get(url); S.cache(key, d); return d; }
    catch (e) { const c = S.cache(key); if (c && e.status === 0) return { ...c, _offline: true }; throw e; }
  }, deps);
}

let toastFn = () => {};
export const toast = (m, kind) => toastFn(m, kind);
function Toasts() {
  const [list, setList] = useState([]);
  toastFn = (m, kind = 'ok') => { const id = Math.random(); setList(l => [...l, { id, m, kind }]); setTimeout(() => setList(l => l.filter(x => x.id !== id)), 4200); };
  return <div className="pp-toasts">{list.map(t => <div key={t.id} className={'pp-toast ' + t.kind}>{t.m}</div>)}</div>;
}

const Field = ({ label, hint, children, wide }) => <label className={'pp-field' + (wide ? ' wide' : '')}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
const Badge = ({ s }) => { const [, l, c] = stage(s); return <span className="pp-badge" style={{ '--c': c }}>{l}</span>; };
const Empty = ({ title, children }) => <div className="pp-empty"><b>{title}</b><p>{children}</p></div>;

// ======================================================================
export default function Portal() {
  useStore();
  const session = S.getSession();
  return <>{session ? <Shell /> : <Welcome />}<Toasts /></>;
}

// ---------------------------------------------------------------- sign in / apply
function Welcome() {
  const [mode, setMode] = useState(new URLSearchParams(location.search).get('apply') != null ? 'apply' : 'in');
  return (
    <div className="pp-welcome">
      <header className="pp-wtop"><a href={SITE}><Logo /></a><a className="pp-link" href="/try">Try MediCore free</a></header>
      <div className="pp-wgrid">
        <section className="pp-pitch">
          <span className="pp-eyebrow">Pentarch MediCore sales partners</span>
          <h1>Sell the system Kenyan pharmacies and clinics are switching to.</h1>
          <p>MediCore runs a facility's counter, stock, patients, lab and money, with or without internet. You introduce it, we install it and support it. You earn on every client.</p>
          <ul className="pp-ticks">
            <li><Icon n="check" s={18} /><span><b>20% of the client's first-year software fees</b>, paid as the client pays</span></li>
            <li><Icon n="check" s={18} /><span><b>KES 5,000 extra</b> for every Counter Kit (computer, scanner, printer) we install</span></li>
            <li><Icon n="check" s={18} /><span>Give any client a <b>free 30-day online demo</b> from your phone in one minute</span></li>
            <li><Icon n="check" s={18} /><span>Record clients and visits even with no network. The app sends them when you are back online.</span></li>
          </ul>
          <div className="pp-gradbar" />
          <p className="pp-small">Questions? Call or WhatsApp Pentarch on <a href={telLink(PHONE)}>{PHONE}</a>.</p>
        </section>
        <section className="pp-card pp-auth">
          <div className="pp-seg">
            <button className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Sign in</button>
            <button className={mode === 'apply' ? 'on' : ''} onClick={() => setMode('apply')}>Become an agent</button>
          </div>
          {mode === 'in' ? <SignIn /> : <Apply done={() => setMode('in')} />}
        </section>
      </div>
    </div>
  );
}
function SignIn() {
  const [f, setF] = useState({ phone: '', pin: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await S.post('/portal/login', f); S.setSession(r); S.sync(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={go} className="pp-form">
      <h2>Welcome back</h2>
      <Field label="Phone number"><input inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} required /></Field>
      <Field label="PIN"><input type="password" inputMode="numeric" autoComplete="current-password" maxLength={8} value={f.pin} onChange={e => setF({ ...f, pin: e.target.value })} required /></Field>
      {err && <div className="pp-err">{err}</div>}
      <button className="pp-btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="pp-small center">Forgot your PIN? WhatsApp <a href={`https://wa.me/${PHONE_WA}`}>Pentarch</a> from the phone you registered.</p>
    </form>
  );
}
function Apply({ done }) {
  const ref = new URLSearchParams(location.search).get('ref') || '';
  const [f, setF] = useState({ name: '', phone: '', email: '', county: '', mpesa: '', id_no: '', pin: '', pin2: '', referral: ref, agree: false });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const go = async e => {
    e.preventDefault(); setErr('');
    if (f.pin !== f.pin2) return setErr('The two PINs do not match');
    setBusy(true);
    try { const r = await S.post('/portal/signup', f); setOk(r.message); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  if (ok) return <div className="pp-form"><div className="pp-okbox"><Icon n="check" s={28} /><h2>Application received</h2><p>{ok}</p></div><button className="pp-btn block" onClick={done}>Back to sign in</button></div>;
  return (
    <form onSubmit={go} className="pp-form">
      <h2>Apply to sell MediCore</h2>
      <p className="pp-small">Anyone can apply: pharmacists, medical reps, IT people, students. Pentarch calls every applicant before approving.</p>
      <Field label="Full name"><input value={f.name} onChange={set('name')} autoComplete="name" required /></Field>
      <div className="pp-row2">
        <Field label="Phone number"><input inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="07…" required /></Field>
        <Field label="M-Pesa number" hint="For commission. Leave empty if same."><input inputMode="tel" value={f.mpesa} onChange={set('mpesa')} /></Field>
      </div>
      <div className="pp-row2">
        <Field label="Email (optional)"><input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="County you will cover"><select value={f.county} onChange={set('county')} required><option value="">Choose…</option>{COUNTIES.map(c => <option key={c}>{c}</option>)}</select></Field>
      </div>
      <div className="pp-row2">
        <Field label="National ID number" hint="Needed before commission is paid"><input inputMode="numeric" value={f.id_no} onChange={set('id_no')} /></Field>
        <Field label="Referred by (agent code)"><input value={f.referral} onChange={set('referral')} placeholder="Optional" style={{ textTransform: 'uppercase' }} /></Field>
      </div>
      <div className="pp-row2">
        <Field label="Choose a PIN (4–8 digits)"><input type="password" inputMode="numeric" maxLength={8} value={f.pin} onChange={set('pin')} required /></Field>
        <Field label="Repeat PIN"><input type="password" inputMode="numeric" maxLength={8} value={f.pin2} onChange={set('pin2')} required /></Field>
      </div>
      <label className="pp-check"><input type="checkbox" checked={f.agree} onChange={set('agree')} required /><span>I will describe MediCore honestly, quote only Pentarch's published prices, and keep client details private.</span></label>
      {err && <div className="pp-err">{err}</div>}
      <button className="pp-btn primary block" disabled={busy}>{busy ? 'Sending…' : 'Send application'}</button>
    </form>
  );
}

// ---------------------------------------------------------------- signed-in shell
function Shell() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || 'home');
  useEffect(() => { const f = () => setRoute(location.hash.slice(1) || 'home'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  useEffect(() => { S.sync(); }, []);
  const go = r => { location.hash = r; window.scrollTo(0, 0); };
  const me = useCached('me', '/portal/me');
  const agent = me.data?.agent || S.getSession().agent;
  const admin = agent?.role === 'admin' || agent?.role === 'manager';
  const [page, arg] = route.split('/');
  const tabs = [['home', 'Home', 'home'], ['clients', 'Clients', 'users'], ['add', 'Add client', 'plus'], ['earnings', 'Earnings', 'cash'], ['more', 'More', 'more']];
  const ctx = { go, me: me.data, agent, admin, reloadMe: me.reload };
  let body;
  if (page === 'clients') body = <Clients {...ctx} />;
  else if (page === 'client') body = <ClientDetail key={arg} uidv={arg} {...ctx} />;
  else if (page === 'add') body = <EditClient {...ctx} />;
  else if (page === 'edit') body = <EditClient key={arg} uidv={arg} {...ctx} />;
  else if (page === 'earnings') body = <Earnings {...ctx} />;
  else if (page === 'prices') body = <Prices {...ctx} />;
  else if (page === 'kit') body = <SalesKit {...ctx} />;
  else if (page === 'agents' && admin) body = <Agents {...ctx} />;
  else if (page === 'all' && admin) body = <AllClients {...ctx} />;
  else if (page === 'more') body = <More {...ctx} />;
  else body = <Home {...ctx} />;
  return (
    <div className="pp-app">
      <header className="pp-top">
        <a href="#home" className="pp-brand"><Logo /><span>Sales</span></a>
        <SyncPill />
      </header>
      <nav className="pp-side">
        {tabs.map(([k, l, i]) => <a key={k} href={'#' + k} className={(page || 'home') === k || (k === 'clients' && page === 'client') ? 'on' : ''}><Icon n={i} /><span>{l}</span></a>)}
        {admin && <><div className="pp-sidehead">Pentarch</div><a href="#agents" className={page === 'agents' ? 'on' : ''}><Icon n="shield" /><span>Agents</span></a><a href="#all" className={page === 'all' ? 'on' : ''}><Icon n="users" /><span>All clients</span></a></>}
      </nav>
      <main className="pp-main">{body}</main>
      <nav className="pp-tabs">
        {tabs.map(([k, l, i]) => <a key={k} href={'#' + k} className={((page || 'home') === k || (k === 'clients' && page === 'client') ? 'on ' : '') + (k === 'add' ? 'fab' : '')}><Icon n={i} s={k === 'add' ? 24 : 20} /><span>{l}</span></a>)}
      </nav>
    </div>
  );
}
function SyncPill() {
  useStore();
  const n = S.pendingCount(); const st = S.syncState;
  const off = st.error === 'offline' || !navigator.onLine;
  const label = st.busy ? 'Sending…' : off ? (n ? `${n} saved on phone` : 'Offline') : n ? `${n} waiting` : st.error ? 'Sync problem' : 'All sent';
  return <button className={'pp-sync' + (off ? ' off' : n ? ' wait' : st.error ? ' bad' : '')} title={st.error && !off ? st.error : st.last ? 'Last sent ' + ago(st.last) : ''} onClick={() => S.sync().then(() => S.syncState.error && S.syncState.error !== 'offline' && toast(S.syncState.error, 'bad'))}><Icon n="sync" s={15} /><span>{label}</span></button>;
}

// ---------------------------------------------------------------- home
function Home({ me, agent, go, admin }) {
  useStore();
  const st = useCached('stats', '/portal/stats');
  const earn = useCached('earn', '/portal/earnings');
  const all = S.leads();
  const month = todayStr().slice(0, 7);
  const won = all.filter(l => l.stage === 'won');
  const wonMonth = won.filter(l => String(l.won_at || l.updated_at).startsWith(month));
  const open = all.filter(l => !['won', 'lost'].includes(l.stage));
  const due = all.filter(l => l.next_date && l.next_date <= todayStr() && !['won', 'lost'].includes(l.stage)).sort((a, b) => a.next_date.localeCompare(b.next_date));
  const trials = all.filter(l => l.demo && !['won', 'lost'].includes(l.stage)).sort((a, b) => String(a.demo.ends).localeCompare(String(b.demo.ends)));
  const pipeline = open.reduce((s, l) => s + (Number(l.value) || estValue(l, me)), 0);
  const first = (agent?.name || '').split(' ')[0];
  const hour = new Date().getHours();
  const link = `${location.origin}/try?agent=${agent?.code || ''}`;
  return (
    <div className="pp-page">
      <div className="pp-hello">
        <div><span className="pp-eyebrow">{hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}</span><h1>{first || 'Agent'}</h1></div>
        <div className="pp-code" title="Your agent code">{agent?.code}</div>
      </div>
      <div className="pp-kpis">
        <button className="pp-kpi" onClick={() => go('clients')}><b>{open.length}</b><span>Open clients</span><small>{KES(pipeline)} in the pipeline</small></button>
        <button className="pp-kpi" onClick={() => go('clients/trial')}><b>{trials.length}</b><span>On 30-day demo</span><small>{trials.filter(t => t.demo?.days_left <= 7).length} ending this week</small></button>
        <button className="pp-kpi" onClick={() => go('clients/won')}><b>{wonMonth.length}</b><span>Won this month</span><small>{won.length} won in total</small></button>
        <button className="pp-kpi grad" onClick={() => go('earnings')}><b>{KES(earn.data?.due || 0)}</b><span>Commission due</span><small>{KES(earn.data?.paid || 0)} paid so far</small></button>
      </div>

      <section className="pp-card">
        <div className="pp-h"><h2>Follow up today</h2><span className="pp-count">{due.length}</span></div>
        {due.length ? <div className="pp-list">{due.slice(0, 8).map(l => <LeadRow key={l.uid} l={l} note={<span className={l.next_date < todayStr() ? 'late' : ''}>{l.next_action || 'Follow up'} · {l.next_date < todayStr() ? 'overdue since ' + fmtDate(l.next_date) : 'today'}</span>} />)}</div>
          : <Empty title="Nothing due">When you set a next step on a client, it shows here on the day.</Empty>}
      </section>

      {trials.length > 0 && <section className="pp-card">
        <div className="pp-h"><h2>Clients trying MediCore</h2><span className="pp-count">{trials.length}</span></div>
        <p className="pp-small">Call each client in the first 3 days, again mid-way, and a week before the demo ends. A demo nobody uses does not convert.</p>
        <div className="pp-list">{trials.slice(0, 8).map(l => <LeadRow key={l.uid} l={l} note={<DemoUse d={l.demo} />} />)}</div>
      </section>}

      <section className="pp-card pp-share">
        <div><h2>Your demo link</h2><p className="pp-small">Send this to any facility. When they start a demo from it, they are recorded as your client automatically.</p></div>
        <div className="pp-linkbox"><code>{link.replace(/^https?:\/\//, '')}</code>
          <button className="pp-btn sm" onClick={() => copy(link)}><Icon n="copy" s={16} />Copy</button>
          <a className="pp-btn sm wa" href={`https://wa.me/?text=${encodeURIComponent(`Try Pentarch MediCore free for 30 days, with sample medicines and patients already loaded. It takes one minute: ${link}`)}`} target="_blank" rel="noreferrer"><Icon n="wa" s={16} />Share</a>
        </div>
      </section>

      {st.data?.board?.length > 0 && <section className="pp-card">
        <div className="pp-h"><h2>Top agents this month</h2></div>
        <ol className="pp-board">{st.data.board.slice(0, 5).map((b, i) => <li key={b.id} className={b.code === agent?.code ? 'me' : ''}><span className="rank">{i + 1}</span><span className="nm">{b.name}{b.code === agent?.code && ' (you)'}</span><span>{b.won_month || 0} won</span><span className="mute">{b.demos || 0} demos</span></li>)}</ol>
      </section>}
      {admin && <p className="pp-small center">You are signed in as Pentarch staff. Use <a href="#agents">Agents</a> to approve new applications.</p>}
    </div>
  );
}
const estValue = (l, me) => { const p = me?.pricing?.plans?.[l.type]; return p ? p.yearly : 0; };
function DemoUse({ d }) {
  if (!d) return null;
  const a = d.activity;
  const used = a && a.bills > 0;
  return <span className={d.days_left != null && d.days_left <= 7 ? 'late' : ''}>
    {d.status === 'expired' ? 'Demo ended' : `${d.days_left ?? '?'} days left`} · {used ? `${a.bills} sales recorded, last used ${ago(a.last)}` : 'not used yet, call them'}
  </span>;
}
function LeadRow({ l, note }) {
  return (
    <a className="pp-lead" href={'#client/' + l.uid}>
      <span className="pp-av" style={{ '--c': stage(l.stage)[2] }}>{(l.facility || '?').slice(0, 1).toUpperCase()}</span>
      <span className="pp-lmain"><b>{l.facility}{l._pending && <i className="pp-dot" title="Saved on this phone, not yet sent" />}</b><small>{note || [l.contact, l.town || l.county].filter(Boolean).join(' · ')}</small></span>
      <Badge s={l.stage} />
    </a>
  );
}
function copy(t) { (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast('Copied'), () => { const a = document.createElement('textarea'); a.value = t; document.body.append(a); a.select(); document.execCommand('copy'); a.remove(); toast('Copied'); }); }

// ---------------------------------------------------------------- clients
function Clients({ go }) {
  useStore();
  const initial = (location.hash.split('/')[1]) || '';
  const [q, setQ] = useState(''); const [f, setF] = useState(initial);
  const all = S.leads();
  const list = all.filter(l => (!f || l.stage === f) && (!q || [l.facility, l.contact, l.phone, l.town, l.county].join(' ').toLowerCase().includes(q.toLowerCase())));
  const counts = Object.fromEntries(STAGES.map(([k]) => [k, all.filter(l => l.stage === k).length]));
  return (
    <div className="pp-page">
      <div className="pp-titlebar"><h1>Clients</h1><button className="pp-btn primary sm" onClick={() => go('add')}><Icon n="plus" s={16} />Add</button></div>
      <div className="pp-search"><Icon n="search" s={18} /><input placeholder="Search name, phone, town" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="pp-chips">
        <button className={!f ? 'on' : ''} onClick={() => setF('')}>All <i>{all.length}</i></button>
        {STAGES.map(([k, l, c]) => <button key={k} className={f === k ? 'on' : ''} style={{ '--c': c }} onClick={() => setF(f === k ? '' : k)}>{l} <i>{counts[k]}</i></button>)}
      </div>
      <section className="pp-card flush">
        {list.length ? <div className="pp-list">{list.map(l => <LeadRow key={l.uid} l={l} />)}</div>
          : all.length ? <Empty title="No match">Try a different search or stage.</Empty>
            : <Empty title="No clients yet">Add the first pharmacy or clinic you visit. It works without network; it is sent when you are back online.<br /><br /><button className="pp-btn primary" onClick={() => go('add')}>Add a client</button></Empty>}
      </section>
    </div>
  );
}

function EditClient({ uidv, go, me }) {
  const ex = uidv ? S.lead(uidv) : null;
  const [f, setF] = useState(() => ex ? { ...ex } : { facility: '', type: 'pharmacy', contact: '', role: 'Owner', phone: '', email: '', county: me?.agent?.county || '', town: '', stage: 'contacted', next_action: 'Call back', next_date: addDays(2), notes: '' });
  const [gps, setGps] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const locate = () => {
    if (!navigator.geolocation) return setGps('This phone cannot share location');
    setGps('Finding location…');
    navigator.geolocation.getCurrentPosition(p => { setF(x => ({ ...x, lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) })); setGps(`Saved (±${Math.round(p.coords.accuracy)} m)`); }, e => setGps(e.code === 1 ? 'Location permission was refused' : 'Could not get location. Try outside.'), { enableHighAccuracy: true, timeout: 15000 });
  };
  const save = e => {
    e.preventDefault();
    const phone = f.phone.replace(/\s/g, '');
    if (phone && !/^(\+?254|0)?[17]\d{8}$/.test(phone)) return toast('Check the phone number, e.g. 0712 345 678', 'bad');
    const dup = !ex && phone && S.leads().find(l => l.phone && l.phone.replace(/\D/g, '').slice(-9) === phone.replace(/\D/g, '').slice(-9));
    if (dup && !confirm(`${dup.facility} already has this phone number in your list. Add anyway?`)) return;
    const rec = S.saveLead(f);
    if (ex && ex.stage !== f.stage) S.logActivity(rec.uid, 'stage', `Stage changed to ${stage(f.stage)[1]}`);
    toast(navigator.onLine ? 'Saved' : 'Saved on this phone. It will be sent when you are online.');
    go('client/' + rec.uid);
  };
  return (
    <div className="pp-page narrow">
      <div className="pp-titlebar"><button className="pp-icon" onClick={() => history.back()} aria-label="Back"><Icon n="back" /></button><h1>{ex ? 'Edit client' : 'Add a client'}</h1></div>
      <form className="pp-card pp-form" onSubmit={save}>
        <Field label="Facility name"><input value={f.facility} onChange={set('facility')} placeholder="e.g. Afya Bora Chemist" required autoFocus={!ex} /></Field>
        <div className="pp-seg3">{TYPES.map(([k, l]) => <button type="button" key={k} className={f.type === k ? 'on' : ''} onClick={() => setF({ ...f, type: k })}>{l.split(' / ')[0]}</button>)}</div>
        <div className="pp-row2">
          <Field label="Contact person"><input value={f.contact} onChange={set('contact')} autoComplete="off" /></Field>
          <Field label="Their role"><select value={f.role || ''} onChange={set('role')}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></Field>
        </div>
        <div className="pp-row2">
          <Field label="Phone"><input inputMode="tel" value={f.phone || ''} onChange={set('phone')} placeholder="07…" /></Field>
          <Field label="Email (optional)"><input type="email" value={f.email || ''} onChange={set('email')} /></Field>
        </div>
        <div className="pp-row2">
          <Field label="County"><select value={f.county || ''} onChange={set('county')}><option value="">Choose…</option>{COUNTIES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Town / area"><input value={f.town || ''} onChange={set('town')} placeholder="e.g. Kitengela" /></Field>
        </div>
        <div className="pp-gps"><button type="button" className="pp-btn sm" onClick={locate}><Icon n="pin" s={16} />{f.lat ? 'Update location' : 'Save my location here'}</button><small>{gps || (f.lat ? `Saved: ${f.lat}, ${f.lng}` : 'Helps Pentarch find the facility for installation')}</small></div>
        <Field label="Where are you with them?"><select value={f.stage} onChange={set('stage')}>{STAGES.filter(s => s[0] !== 'won').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        {f.stage === 'lost' && <Field label="Why was it lost?"><select value={f.lost_reason || ''} onChange={set('lost_reason')}><option value="">Choose…</option>{LOST.map(r => <option key={r}>{r}</option>)}</select></Field>}
        {f.stage !== 'lost' && <div className="pp-row2">
          <Field label="Next step"><input value={f.next_action || ''} onChange={set('next_action')} list="pp-next" /></Field>
          <Field label="When"><input type="date" value={f.next_date || ''} onChange={set('next_date')} /></Field>
          <datalist id="pp-next"><option>Call back</option><option>Visit with demo</option><option>Start online demo</option><option>Check demo use</option><option>Send quotation</option><option>Collect payment</option><option>Book installation</option></datalist>
        </div>}
        <Field label="Notes" hint="What they use now, number of staff, what they care about"><textarea rows={3} value={f.notes || ''} onChange={set('notes')} /></Field>
        <button className="pp-btn primary block">{ex ? 'Save changes' : 'Save client'}</button>
      </form>
    </div>
  );
}

function ClientDetail({ uidv, go, me, admin }) {
  useStore();
  const l = S.lead(uidv);
  const [act, setAct] = useState({ kind: 'call', note: '' });
  const [modal, setModal] = useState(null);
  if (!l) return <div className="pp-page"><Empty title="Client not found">It may still be loading. <a href="#clients">Back to clients</a></Empty></div>;
  const [, sl, sc] = stage(l.stage);
  const addAct = e => {
    e.preventDefault(); if (!act.note.trim()) return;
    S.logActivity(l.uid, act.kind, act.note.trim()); setAct({ ...act, note: '' }); toast('Logged');
  };
  const quick = (patch, note) => { S.saveLead({ ...l, ...patch }); if (note) S.logActivity(l.uid, 'stage', note); };
  const msg = `Hello ${l.contact || ''}, this is ${me?.agent?.name || 'your Pentarch agent'} from Pentarch MediCore. `;
  return (
    <div className="pp-page">
      <div className="pp-titlebar"><button className="pp-icon" onClick={() => go('clients')} aria-label="Back"><Icon n="back" /></button><h1 className="ell">{l.facility}</h1><a className="pp-btn sm" href={'#edit/' + l.uid}>Edit</a></div>
      <section className="pp-card pp-cl-head" style={{ '--c': sc }}>
        <div className="pp-cl-top"><Badge s={l.stage} /><span className="pp-small">{typeLabel(l.type)}{l.source === 'website' ? ' · came from the website' : ''}</span></div>
        <div className="pp-cl-who"><b>{l.contact || 'No contact name'}</b>{l.role && <span> · {l.role}</span>}</div>
        <div className="pp-small">{[l.town, l.county].filter(Boolean).join(', ')}{l.lat && <> · <a href={`https://maps.google.com/?q=${l.lat},${l.lng}`} target="_blank" rel="noreferrer">map</a></>}</div>
        {l._pending && <div className="pp-pend">Saved on this phone, waiting for internet to send.</div>}
        <div className="pp-actions">
          {l.phone && <a className="pp-btn" href={telLink(l.phone)} onClick={() => S.logActivity(l.uid, 'call', 'Called ' + l.phone)}><Icon n="phone" s={16} />Call</a>}
          {l.phone && <a className="pp-btn wa" href={waLink(l.phone, msg)} target="_blank" rel="noreferrer" onClick={() => S.logActivity(l.uid, 'whatsapp', 'WhatsApp message')}><Icon n="wa" s={16} />WhatsApp</a>}
          {!l.demo && l.stage !== 'won' && <button className="pp-btn primary" onClick={() => setModal('demo')}><Icon n="play" s={16} />Start 30-day demo</button>}
          {l.stage !== 'won' && <button className="pp-btn good" onClick={() => setModal('won')}><Icon n="trophy" s={16} />Mark as won</button>}
          {admin && <button className="pp-btn" onClick={() => setModal('key')}><Icon n="key" s={16} />Licence key</button>}
        </div>
      </section>

      {l.demo && <section className="pp-card pp-demo">
        <div className="pp-h"><h2>Online demo</h2><span className={'pp-badge'} style={{ '--c': l.demo.status === 'expired' ? '#EE4B3B' : '#14B1AC' }}>{l.demo.status === 'active' ? 'Converted to live' : l.demo.status === 'expired' ? 'Ended' : `${l.demo.days_left} days left`}</span></div>
        <div className="pp-creds"><div><small>Web address</small><b>{location.host}</b></div><div><small>Username</small><b>{l.demo.user}</b></div><div><small>PIN</small><b>{l.demo.pin || '••••'}</b></div><div><small>Ends</small><b>{fmtDate(l.demo.ends)}</b></div></div>
        <p className="pp-small"><DemoUse d={l.demo} /></p>
        <div className="pp-actions">
          <a className="pp-btn wa" target="_blank" rel="noreferrer" href={waLink(l.phone, demoMessage(l, me))}><Icon n="wa" s={16} />Send sign-in on WhatsApp</a>
          <button className="pp-btn" onClick={() => copy(demoMessage(l, me))}><Icon n="copy" s={16} />Copy</button>
        </div>
      </section>}

      <section className="pp-card">
        <div className="pp-h"><h2>Next step</h2></div>
        <div className="pp-next">
          <div><b>{l.next_action || 'None set'}</b><small>{l.next_date ? fmtDate(l.next_date) + (l.next_date < todayStr() ? ' · overdue' : '') : ''}</small></div>
          <div className="pp-quick">
            {[['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map(([t, n]) => <button key={n} className="pp-chip" onClick={() => { quick({ next_date: addDays(n), next_action: l.next_action || 'Call back' }); toast('Next step moved to ' + fmtDate(addDays(n))); }}>{t}</button>)}
          </div>
        </div>
        <div className="pp-stages">{STAGES.filter(s => s[0] !== 'won').map(([k, lb, c]) => <button key={k} className={l.stage === k ? 'on' : ''} style={{ '--c': c }} onClick={() => l.stage !== k && (k === 'lost' ? go('edit/' + l.uid) || quick({ stage: 'lost' }, 'Stage changed to Lost') : quick({ stage: k }, 'Stage changed to ' + lb))}>{lb}</button>)}</div>
      </section>

      <section className="pp-card">
        <div className="pp-h"><h2>Activity</h2></div>
        <form className="pp-logform" onSubmit={addAct}>
          <select value={act.kind} onChange={e => setAct({ ...act, kind: e.target.value })}>{ACTS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
          <input placeholder="What happened? e.g. Owner wants to see stock reports" value={act.note} onChange={e => setAct({ ...act, note: e.target.value })} />
          <button className="pp-btn primary sm">Log</button>
        </form>
        <ol className="pp-timeline">
          {(l.activities || []).map(a => <li key={a.uid || a.id} className={a.kind}><b>{(ACTS.find(x => x[0] === a.kind) || [, a.kind === 'won' ? 'Won' : a.kind === 'licence' ? 'Licence' : a.kind === 'stage' ? 'Update' : a.kind === 'created' ? 'Added' : 'Note'])[1]}</b><span>{a.note}</span><small>{ago(a.at)}{a._pending ? ' · not yet sent' : ''}</small></li>)}
          {!(l.activities || []).length && <li className="mute"><span>No activity yet.</span></li>}
        </ol>
        {l.notes && <div className="pp-notes"><small>Notes</small><p>{l.notes}</p></div>}
      </section>
      {modal === 'demo' && <DemoModal l={l} close={() => setModal(null)} />}
      {modal === 'won' && <WonModal l={l} me={me} close={() => setModal(null)} />}
      {modal === 'key' && <KeyModal l={l} me={me} close={() => setModal(null)} />}
    </div>
  );
}
const demoMessage = (l, me) => `Hello ${l.contact || ''}, your Pentarch MediCore demo for ${l.facility} is ready.\n\nOpen: ${location.origin}\nUsername: ${l.demo.user}\nPIN: ${l.demo.pin || '(as given)'}\n\nIt already has sample medicines, patients and sales so you can try everything: counter sales, stock, reports. The demo runs until ${fmtDate(l.demo.ends)}. Call me any time: ${me?.agent?.name || ''} ${me?.agent?.phone || ''}`;

function Modal({ title, close, children }) {
  useEffect(() => { const f = e => e.key === 'Escape' && close(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, []);
  return <div className="pp-modal" onClick={e => e.target === e.currentTarget && close()}><div className="pp-card pp-sheet" role="dialog" aria-label={title}><div className="pp-h"><h2>{title}</h2><button className="pp-icon" onClick={close} aria-label="Close">✕</button></div>{children}</div></div>;
}
function DemoModal({ l, close }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const start = async () => {
    setBusy(true); setErr('');
    try {
      await S.sync(); // the client must reach Pentarch first
      await S.post(`/portal/leads/${l.uid}/demo`);
      await S.sync(); toast('Demo created. Send the sign-in to the client.'); close();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return <Modal title="Start a 30-day online demo" close={close}>
    <p>Pentarch creates a private MediCore for <b>{l.facility}</b> ({typeLabel(l.type)}) with sample medicines, patients and sales already in it. The client signs in from any phone or computer.</p>
    <ul className="pp-ticks small"><li><Icon n="check" s={16} /><span>Free for 30 days. No devices needed.</span></li><li><Icon n="check" s={16} /><span>If they buy, their demo becomes their live system: nothing to re-enter.</span></li><li><Icon n="check" s={16} /><span>If they do not, it is deleted 15 days after it ends.</span></li></ul>
    {!navigator.onLine && <div className="pp-err">You need internet to create a demo. The client is saved; try again when you have network.</div>}
    {err && <div className="pp-err">{err}</div>}
    <button className="pp-btn primary block" disabled={busy || !navigator.onLine} onClick={start}>{busy ? 'Creating…' : 'Create the demo'}</button>
  </Modal>;
}
function WonModal({ l, me, close }) {
  const P = me?.pricing;
  const [f, setF] = useState({ plan: P?.plans[l.type] ? l.type : 'pharmacy', billing: 'yearly', kit: false, amount_paid: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  if (!P) return <Modal title="Mark as won" close={close}><p>Connect to the internet once so the price list can load.</p></Modal>;
  const p = P.plans[f.plan];
  const year = f.billing === 'monthly' ? p.monthly * 12 : p.yearly;
  const comm = Math.round(year * P.commission.softwareRate) + (f.kit ? P.commission.kitBonus : 0);
  const save = async () => {
    setBusy(true); setErr('');
    try { await S.sync(); const r = await S.post(`/portal/leads/${l.uid}/won`, f); S.putServerLead(r); toast('Congratulations! Pentarch will call the client to book installation.'); close(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return <Modal title="Mark as won" close={close}>
    <Field label="Plan bought"><select value={f.plan} onChange={e => setF({ ...f, plan: e.target.value })}>{Object.entries(P.plans).map(([k, v]) => <option key={k} value={k}>{v.label}: {KES(v.monthly)}/month or {KES(v.yearly)}/year</option>)}</select></Field>
    <div className="pp-seg"><button className={f.billing === 'yearly' ? 'on' : ''} onClick={() => setF({ ...f, billing: 'yearly' })}>Paying yearly</button><button className={f.billing === 'monthly' ? 'on' : ''} onClick={() => setF({ ...f, billing: 'monthly' })}>Paying monthly</button></div>
    <label className="pp-check"><input type="checkbox" checked={f.kit} onChange={e => setF({ ...f, kit: e.target.checked })} /><span>Also bought the Counter Kit ({KES(P.kit.price)})</span></label>
    <Field label="Amount paid so far (optional)"><input inputMode="numeric" value={f.amount_paid} onChange={e => setF({ ...f, amount_paid: e.target.value.replace(/\D/g, '') })} /></Field>
    <div className="pp-sum"><div><span>Client pays (first year)</span><b>{KES(year + p.setup + (f.kit ? P.kit.price : 0))}</b><small>{KES(year)} software + {KES(p.setup)} setup{f.kit ? ` + ${KES(P.kit.price)} kit` : ''}</small></div><div className="grad"><span>Your commission</span><b>{KES(comm)}</b><small>paid as the client pays</small></div></div>
    {err && <div className="pp-err">{err}</div>}
    <button className="pp-btn good block" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Confirm the sale'}</button>
  </Modal>;
}
function KeyModal({ l, me, close }) {
  const [f, setF] = useState({ plan: l.plan || l.type || 'pharmacy', months: 12, branches: 1, org_name: l.facility });
  const [r, setR] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const issue = async () => {
    setBusy(true); setErr('');
    try { await S.sync(); setR(await S.post(`/portal/leads/${l.uid}/licence`, f)); S.sync(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return <Modal title="Issue a licence key" close={close}>
    {!me?.canIssue && <div className="pp-err">The signing key is not installed on this server, so keys cannot be issued here.</div>}
    {r ? <>
      <p>Key <b>{r.id}</b> for {f.org_name}, valid until <b>{fmtDate(r.until)}</b>.{l.demo ? ' Their online demo is now their live system.' : ' Enter it in MediCore: Settings → Licence.'}</p>
      <textarea className="pp-key" readOnly rows={5} value={r.key} onFocus={e => e.target.select()} />
      <div className="pp-actions"><button className="pp-btn primary" onClick={() => copy(r.key)}><Icon n="copy" s={16} />Copy key</button><a className="pp-btn wa" target="_blank" rel="noreferrer" href={waLink(l.phone, `Your Pentarch MediCore licence key (valid to ${r.until}). In MediCore open Settings → Licence and paste it:\n\n${r.key}`)}><Icon n="wa" s={16} />Send</a></div>
    </> : <>
      <Field label="Name on the licence"><input value={f.org_name} onChange={e => setF({ ...f, org_name: e.target.value })} /></Field>
      <div className="pp-row2">
        <Field label="Plan"><select value={f.plan} onChange={e => setF({ ...f, plan: e.target.value })}><option value="pharmacy">Pharmacy</option><option value="clinic">Clinic</option><option value="hospital">Hospital</option><option value="group">Group</option></select></Field>
        <Field label="Months paid"><select value={f.months} onChange={e => setF({ ...f, months: +e.target.value })}>{[1, 3, 6, 12, 24, 36].map(m => <option key={m} value={m}>{m}</option>)}</select></Field>
      </div>
      <Field label="Branches"><input type="number" min={1} max={50} value={f.branches} onChange={e => setF({ ...f, branches: e.target.value })} /></Field>
      <p className="pp-small">The key is tied to the client's phone number {l.phone} and works offline.</p>
      {err && <div className="pp-err">{err}</div>}
      <button className="pp-btn primary block" disabled={busy || !me?.canIssue} onClick={issue}>{busy ? 'Signing…' : 'Issue key'}</button>
    </>}
  </Modal>;
}

// ---------------------------------------------------------------- earnings
function Earnings({ admin }) {
  const [all, setAll] = useState(false);
  const e = useCached('earn' + (all ? 'all' : ''), '/portal/earnings' + (all ? '?all=1' : ''), [all]);
  const d = e.data;
  const pay = async r => {
    const ref = prompt(`M-Pesa reference for paying ${r.agent} ${KES(r.amount)}:`);
    if (ref == null) return;
    try { await S.post(`/portal/commissions/${r.id}/paid`, { ref }); toast('Marked as paid'); e.reload(); } catch (x) { toast(x.message, 'bad'); }
  };
  return (
    <div className="pp-page">
      <div className="pp-titlebar"><h1>Earnings</h1>{admin && <label className="pp-check inline"><input type="checkbox" checked={all} onChange={x => setAll(x.target.checked)} /><span>All agents</span></label>}</div>
      <div className="pp-kpis two">
        <div className="pp-kpi grad"><b>{KES(d?.due || 0)}</b><span>Due to {all ? 'agents' : 'you'}</span><small>Paid by M-Pesa within 7 days of the client's payment</small></div>
        <div className="pp-kpi"><b>{KES(d?.paid || 0)}</b><span>Paid so far</span></div>
      </div>
      <section className="pp-card flush">
        {e.loading && !d ? <div className="pp-load" /> : d?.rows?.length ? <table className="pp-table">
          <thead><tr><th>Client</th>{all && <th>Agent</th>}<th>For</th><th className="r">Amount</th><th>Status</th></tr></thead>
          <tbody>{d.rows.map(r => <tr key={r.id}><td>{r.facility}</td>{all && <td>{r.agent}</td>}<td className="mute">{r.description}</td><td className="r"><b>{KES(r.amount)}</b></td><td>{r.status === 'paid' ? <span className="pp-badge" style={{ '--c': '#16A34A' }}>Paid {fmtDate(r.paid_at)}</span> : admin && all ? <button className="pp-btn sm" onClick={() => pay(r)}>Mark paid</button> : <span className="pp-badge" style={{ '--c': '#F6B22C' }}>Due</span>}</td></tr>)}</tbody>
        </table> : <Empty title="No commission yet">When a client you registered buys, your commission appears here.</Empty>}
      </section>
      {e.error && <div className="pp-err">{e.error.message}</div>}
      <HowPaid />
    </div>
  );
}
const HowPaid = () => <section className="pp-card"><h2>How commission works</h2><ul className="pp-ticks small">
  <li><Icon n="check" s={16} /><span>20% of the client's first-year software fees. On a monthly plan, you earn on each of the first 12 monthly payments.</span></li>
  <li><Icon n="check" s={16} /><span>KES 5,000 for every Counter Kit Pentarch installs for your client.</span></li>
  <li><Icon n="check" s={16} /><span>A client belongs to the agent who recorded them first in this portal. Duplicates are checked by phone number.</span></li>
  <li><Icon n="check" s={16} /><span>Paid to your M-Pesa within 7 days of Pentarch receiving the client's money.</span></li>
</ul></section>;

// ---------------------------------------------------------------- prices and quote
function Prices({ me }) {
  const P = me?.pricing;
  const [q, setQ] = useState({ plan: 'pharmacy', billing: 'yearly', branches: 1, kit: 1, addons: {} });
  if (!P) return <div className="pp-page"><Empty title="Price list not loaded">Connect to the internet once and it will be saved on this phone.</Empty></div>;
  const p = P.plans[q.plan];
  const per = q.billing === 'yearly' ? p.yearly : p.monthly;
  let soft = 0; for (let i = 1; i <= q.branches; i++) soft += i >= 3 ? per * 0.85 : per;
  const setup = p.setup * q.branches;
  const kit = P.kit.price * q.kit;
  const add = P.addons.reduce((s, [n, , price]) => s + (q.addons[n] || 0) * price, 0);
  const first = soft + setup + kit + add;
  const quoteText = `Pentarch MediCore quotation\n${p.label} plan, ${q.branches} branch${q.branches > 1 ? 'es' : ''}\n\nSoftware (${q.billing}): ${KES(soft)}${q.billing === 'monthly' ? ' per month' : ' per year'}\nSetup, data import and training: ${KES(setup)} once\n${q.kit ? `Counter Kit x${q.kit}: ${KES(kit)} once\n` : ''}${P.addons.filter(([n]) => q.addons[n]).map(([n, , pr]) => `${n} x${q.addons[n]}: ${KES(pr * q.addons[n])}\n`).join('')}\nTotal to start: ${KES(first)}\n\nPrices in KES. Valid 30 days. Pentarch Communications, ${PHONE}.`;
  const n = (k, v) => setQ({ ...q, [k]: Math.max(0, Math.min(20, v)) });
  return (
    <div className="pp-page">
      <div className="pp-titlebar"><h1>Prices and quotes</h1></div>
      <div className="pp-plans">{Object.entries(P.plans).map(([k, v]) => <button key={k} className={'pp-plan' + (q.plan === k ? ' on' : '')} onClick={() => setQ({ ...q, plan: k })}>
        <span className="pp-eyebrow">{v.label}</span><b>{KES(v.monthly)}<small>/month</small></b><span>or {KES(v.yearly)} a year (2 months free)</span><small>Setup {KES(v.setup)} once · {v.for}</small>
      </button>)}</div>
      <section className="pp-card">
        <h2>Build a quote</h2>
        <div className="pp-seg"><button className={q.billing === 'yearly' ? 'on' : ''} onClick={() => setQ({ ...q, billing: 'yearly' })}>Yearly</button><button className={q.billing === 'monthly' ? 'on' : ''} onClick={() => setQ({ ...q, billing: 'monthly' })}>Monthly</button></div>
        <div className="pp-qrows">
          <Stepper label="Branches" v={q.branches} set={v => n('branches', Math.max(1, v))} hint="15% off every branch from the third" />
          <Stepper label={`Counter Kit (${KES(P.kit.price)})`} v={q.kit} set={v => n('kit', v)} hint="0 if the client uses their own computer" />
          {P.addons.map(([nm, d, pr]) => <Stepper key={nm} label={`${nm} (${KES(pr)})`} hint={d} v={q.addons[nm] || 0} set={v => setQ({ ...q, addons: { ...q.addons, [nm]: Math.max(0, Math.min(20, v)) } })} />)}
        </div>
        <div className="pp-sum">
          <div><span>Software</span><b>{KES(soft)}</b><small>{q.billing === 'yearly' ? 'per year' : 'per month'}</small></div>
          <div><span>One-off</span><b>{KES(setup + kit + add)}</b><small>setup, devices, extras</small></div>
          <div className="grad"><span>Total to start</span><b>{KES(first)}</b><small>your commission ≈ {KES((q.billing === 'yearly' ? soft : soft * 12) * P.commission.softwareRate + q.kit * P.commission.kitBonus)}</small></div>
        </div>
        <div className="pp-actions"><button className="pp-btn primary" onClick={() => copy(quoteText)}><Icon n="copy" s={16} />Copy quote</button><a className="pp-btn wa" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(quoteText)}`}><Icon n="wa" s={16} />Send on WhatsApp</a></div>
      </section>
      <section className="pp-card">
        <h2>{P.kit.name}: {KES(P.kit.price)}</h2>
        <p className="pp-small">{P.kit.note}</p>
        <dl className="pp-kit">{P.kit.items.map(([a, b]) => <React.Fragment key={a}><dt>{a}</dt><dd>{b}</dd></React.Fragment>)}</dl>
      </section>
      <p className="pp-small center">Price list updated {fmtDate(P.updated)}. Quote only these prices. Discounts are approved by Pentarch.</p>
    </div>
  );
}
const Stepper = ({ label, hint, v, set }) => <div className="pp-step"><div><b>{label}</b>{hint && <small>{hint}</small>}</div><div className="pp-stepper"><button type="button" onClick={() => set(v - 1)} aria-label="Less">−</button><span>{v}</span><button type="button" onClick={() => set(v + 1)} aria-label="More">+</button></div></div>;

// ---------------------------------------------------------------- sales kit
function SalesKit() {
  const [open, setOpen] = useState(0);
  const items = [
    ['The 30-second pitch', <><p>"MediCore is the system that runs your {`pharmacy`} counter, stock and money in one place. It keeps working when the internet or KPLC goes off, it flags expiring stock before it costs you, and it shows you every evening what you sold and what you made. You can try it free for 30 days on your phone today."</p></>],
    ['Questions to ask first', <ul className="pp-bul"><li>How do you record sales now: book, Excel, another system?</li><li>How do you know what is about to expire?</li><li>When did you last count stock, and did it match?</li><li>Who closes the till at night, and how do you check the cash?</li><li>How many staff use the counter? Any branches?</li><li>Are you on SHA? How do you do claims today?</li></ul>],
    ['What to show in a 10-minute demo', <ol className="pp-bul"><li>Scan a box and sell it with M-Pesa. Print the receipt.</li><li>Open Inventory: show expiry warnings and the reorder list.</li><li>Open Reports → Profit and loss: what they made today.</li><li>Close the shift: the cash count and the variance.</li><li>Pull the internet cable or switch off Wi-Fi: it keeps working.</li></ol>],
    ['Answers to common objections', <dl className="pp-faq">
      <dt>"It is expensive."</dt><dd>A pharmacy plan is KES 2,500 a month, about KES 83 a day. One expired carton of antibiotics caught in time pays for months.</dd>
      <dt>"We have no internet."</dt><dd>MediCore runs on the computer in the facility. Internet is only used for backup and M-Pesa prompts.</dd>
      <dt>"My staff are not good with computers."</dt><dd>The counter screen is built for speed: scan, take payment, done. Setup includes training for the whole team.</dd>
      <dt>"We already have a system."</dt><dd>Ask what it does not do for them: expiry, cash-up, offline. Offer the 30-day demo side by side. Pentarch imports their item list.</dd>
      <dt>"What about SHA?"</dt><dd>MediCore records SHA numbers, visits and claims. Formal SHA integration depends on DHA certification; tell the client honestly what Pentarch has confirmed and check with Pentarch before promising dates.</dd>
    </dl>],
    ['Rules for agents', <ul className="pp-bul"><li>Quote only the published prices. Discounts need Pentarch's approval.</li><li>Never collect money in cash. Clients pay Pentarch's M-Pesa paybill or bank.</li><li>Never promise features you have not seen working. Say "let me confirm with Pentarch".</li><li>Record every client here the same day, so your commission is protected.</li><li>Keep client details private.</li></ul>],
  ];
  return (
    <div className="pp-page narrow">
      <div className="pp-titlebar"><h1>Sales kit</h1></div>
      {items.map(([t, c], i) => <section key={t} className={'pp-card pp-acc' + (open === i ? ' open' : '')}><button className="pp-acc-h" onClick={() => setOpen(open === i ? -1 : i)}><h2>{t}</h2><span>{open === i ? '−' : '+'}</span></button>{open === i && <div className="pp-acc-b">{c}</div>}</section>)}
      <section className="pp-card"><h2>Need help with a client?</h2><p className="pp-small">Pentarch can join a call or a visit for big facilities.</p><div className="pp-actions"><a className="pp-btn" href={telLink(PHONE)}><Icon n="phone" s={16} />{PHONE}</a><a className="pp-btn wa" href={`https://wa.me/${PHONE_WA}`} target="_blank" rel="noreferrer"><Icon n="wa" s={16} />WhatsApp Pentarch</a></div></section>
    </div>
  );
}

// ---------------------------------------------------------------- more
function More({ agent, admin, go }) {
  useStore();
  const out = () => { if (S.pendingCount() && !confirm(`${S.pendingCount()} changes have not been sent yet and will be lost if you sign out. Sign out anyway?`)) return; S.setSession(null); location.hash = ''; };
  return (
    <div className="pp-page narrow">
      <div className="pp-titlebar"><h1>More</h1></div>
      <section className="pp-card pp-me"><div className="pp-av big">{(agent?.name || '?').slice(0, 1)}</div><div><b>{agent?.name}</b><small>{agent?.phone} · {agent?.county}</small><small>Agent code <b>{agent?.code}</b></small></div></section>
      <div className="pp-menu">
        <a href="#prices"><Icon n="tag" /><span><b>Prices and quotes</b><small>Plans, Counter Kit, quote builder</small></span></a>
        <a href="#kit"><Icon n="book" /><span><b>Sales kit</b><small>Pitch, demo script, objections, rules</small></span></a>
        <a href="/try" target="_blank"><Icon n="play" /><span><b>Open the demo form</b><small>For a client sitting with you</small></span></a>
        {admin && <a href="#agents"><Icon n="shield" /><span><b>Agents</b><small>Approve applications, suspend</small></span></a>}
        {admin && <a href="#all"><Icon n="users" /><span><b>All clients</b><small>Every agent's pipeline</small></span></a>}
        <a href={`https://wa.me/${PHONE_WA}`} target="_blank" rel="noreferrer"><Icon n="wa" /><span><b>WhatsApp Pentarch</b><small>{PHONE}</small></span></a>
        <button onClick={out}><Icon n="out" /><span><b>Sign out</b><small>Clients you saved stay on Pentarch's server</small></span></button>
      </div>
      <p className="pp-small center">Tip: add this page to your home screen (browser menu → Add to Home screen) and it works like an app, even offline.</p>
    </div>
  );
}

// ---------------------------------------------------------------- Pentarch admin
function Agents() {
  const a = useAsync(() => S.get('/portal/agents'));
  const [f, setF] = useState('pending');
  const set = async (x, status, role) => { try { await S.post(`/portal/agents/${x.id}/status`, { status, role }); toast(`${x.name}: ${status}`); a.reload(); } catch (e) { toast(e.message, 'bad'); } };
  const list = (a.data || []).filter(x => !f || x.status === f);
  return (
    <div className="pp-page">
      <div className="pp-titlebar"><h1>Agents</h1></div>
      <div className="pp-chips">{['pending', 'active', 'suspended', 'rejected', ''].map(s => <button key={s} className={f === s ? 'on' : ''} onClick={() => setF(s)}>{s || 'All'} <i>{(a.data || []).filter(x => !s || x.status === s).length}</i></button>)}</div>
      <section className="pp-card flush">
        {a.error ? <div className="pp-err">{a.error.message}</div> : !list.length ? <Empty title="None here">{f === 'pending' ? 'No applications waiting.' : ''}</Empty> :
          <table className="pp-table"><thead><tr><th>Agent</th><th>County</th><th className="r">Clients</th><th className="r">Won</th><th></th></tr></thead>
            <tbody>{list.map(x => <tr key={x.id}><td><b>{x.name}</b> <span className="mute">{x.code}</span><br /><small><a href={telLink(x.phone)}>{x.phone}</a>{x.id_no ? ' · ID ' + x.id_no : ''}{x.referred_by ? ' · via ' + x.referred_by : ''} · {ago(x.created_at)}</small></td><td>{x.county}</td><td className="r">{x.leads}</td><td className="r">{x.won}</td>
              <td className="r nowrap">{x.status !== 'active' && <button className="pp-btn sm good" onClick={() => set(x, 'active')}>Approve</button>} {x.status === 'pending' && <button className="pp-btn sm" onClick={() => set(x, 'rejected')}>Reject</button>}{x.status === 'active' && x.role !== 'admin' && <button className="pp-btn sm" onClick={() => confirm(`Suspend ${x.name}? They will not be able to sign in.`) && set(x, 'suspended')}>Suspend</button>}</td></tr>)}</tbody></table>}
      </section>
    </div>
  );
}
function AllClients() {
  const a = useAsync(() => S.get('/portal/leads?all=1'));
  const st = useAsync(() => S.get('/portal/stats?all=1'));
  const [q, setQ] = useState('');
  const list = (a.data || []).filter(l => !q || [l.facility, l.agent_name, l.phone, l.county, l.stage].join(' ').toLowerCase().includes(q.toLowerCase()));
  const by = Object.fromEntries((st.data?.byStage || []).map(r => [r.stage, r]));
  return (
    <div className="pp-page">
      <div className="pp-titlebar"><h1>All clients</h1></div>
      <div className="pp-funnel">{STAGES.map(([k, l, c]) => <div key={k} style={{ '--c': c }}><b>{by[k]?.n || 0}</b><span>{l}</span><small>{KES(by[k]?.v || 0)}</small></div>)}</div>
      <div className="pp-search"><Icon n="search" s={18} /><input placeholder="Search facility, agent, county, stage" value={q} onChange={e => setQ(e.target.value)} /></div>
      <section className="pp-card flush">
        <table className="pp-table"><thead><tr><th>Facility</th><th>Agent</th><th>Stage</th><th>Demo</th><th>Updated</th></tr></thead>
          <tbody>{list.map(l => <tr key={l.uid} onClick={() => { S.putServerLead(l); location.hash = 'client/' + l.uid; }} className="click"><td><b>{l.facility}</b><br /><small className="mute">{typeLabel(l.type)} · {[l.town, l.county].filter(Boolean).join(', ')}</small></td><td>{l.agent_name || <span className="mute">Website</span>}</td><td><Badge s={l.stage} /></td><td><small>{l.demo ? <DemoUse d={l.demo} /> : '—'}</small></td><td className="mute">{ago(l.updated_at)}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}
