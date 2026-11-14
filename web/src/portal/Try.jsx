import React, { useState } from 'react';
import Logo from './Logo';
import { LOGO, SITE, PHONE, PHONE_WA, COUNTIES, TYPES } from './data';

const params = new URLSearchParams(location.search);
const FEATURES = {
  pharmacy: ['Scan-and-sell counter with M-Pesa, cash and credit', 'Expiry alerts and a reorder list built from sales', 'Shift cash-up with over/short per cashier', 'Profit and loss for any day, week or month'],
  clinic: ['Patient registration, triage and consultation notes', 'Lab requests and results', 'Dispensing straight from the doctor\'s prescription', 'Billing with SHA, insurance, M-Pesa and cash'],
  hospital: ['Admissions, wards and bed management', 'Inpatient charges and discharge billing', 'Lab, pharmacy and stores in one system', 'Reports per department and per branch'],
};

export default function Try() {
  const [f, setF] = useState({ facility: '', type: params.get('type') || 'pharmacy', contact: '', phone: '', email: '', county: '', town: '', agent: params.get('agent') || params.get('ref') || '', agree: false });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [res, setRes] = useState(null);
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const go = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await fetch('/api/public/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again or call us.');
      setRes(d);
      window.scrollTo(0, 0);
    } catch (x) { setErr(x.message === 'Failed to fetch' ? 'No internet connection. Please check your connection and try again.' : x.message); }
    finally { setBusy(false); }
  };
  const open = () => {
    try { localStorage.setItem('mc_session', JSON.stringify(res.session)); const b = res.session.branch_id || res.session.branches?.[0]?.id; b ? localStorage.setItem('mc_branch', JSON.stringify(b)) : localStorage.removeItem('mc_branch'); } catch {}
    location.href = '/';
  };
  return (
    <div className="pp-try">
      <header className="pp-wtop"><a href={SITE + '/medicore/'}><Logo /></a><a className="pp-link" href={`https://wa.me/${PHONE_WA}?text=${encodeURIComponent('Hello Pentarch, I would like a guided MediCore demo.')}`}>Talk to us</a></header>
      <div className="pp-wgrid">
        <section className="pp-pitch">
          <span className="pp-eyebrow">Pentarch MediCore · free 30-day demo</span>
          <h1>Run your {f.type === 'pharmacy' ? 'pharmacy' : f.type === 'clinic' ? 'clinic' : 'hospital'} on MediCore for a month. Free.</h1>
          <p>You get your own private copy, already filled with sample medicines, patients and a month of sales, so every screen has something to show. Use it on your phone or computer. No devices, no payment, no commitment.</p>
          <ul className="pp-ticks">{FEATURES[f.type].map(t => <li key={t}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" /></svg><span>{t}</span></li>)}</ul>
          <div className="pp-gradbar" />
          <p className="pp-small">The installed version runs on a computer in your facility and keeps working without internet. The online demo needs internet. If you buy, your demo becomes your live system: nothing to re-enter.</p>
        </section>
        <section className="pp-card pp-auth">
          {res ? <div className="pp-form">
            <div className="pp-okbox"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" /></svg><h2>Your demo is ready</h2><p>Write these down or take a screenshot. You will need them to sign in again.</p></div>
            <div className="pp-creds big"><div><small>Web address</small><b>{location.host}</b></div><div><small>Username</small><b>{res.username}</b></div><div><small>PIN</small><b>{res.pin}</b></div><div><small>Free until</small><b>{new Date(res.ends + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'long' })}</b></div></div>
            <button className="pp-btn primary block" onClick={open}>Open my MediCore</button>
            <p className="pp-small center">The sample team (reception, pharmacist, cashier and others) sign in with PIN <b>{res.staff_pin || 'shown in Settings → Staff'}</b>. See their usernames in Settings → Staff &amp; access.</p>
            <p className="pp-small center">Want someone to walk you through it? WhatsApp <a href={`https://wa.me/${PHONE_WA}`}>{PHONE}</a>.</p>
          </div> : <form className="pp-form" onSubmit={go}>
            <h2>Start your free demo</h2>
            <div className="pp-seg3">{TYPES.map(([k, l]) => <button type="button" key={k} className={f.type === k ? 'on' : ''} onClick={() => setF({ ...f, type: k })}>{l.split(' / ')[0]}</button>)}</div>
            <label className="pp-field"><span>Facility name</span><input value={f.facility} onChange={set('facility')} placeholder="e.g. Afya Bora Chemist" required /></label>
            <div className="pp-row2">
              <label className="pp-field"><span>Your name</span><input value={f.contact} onChange={set('contact')} autoComplete="name" required /></label>
              <label className="pp-field"><span>Phone</span><input inputMode="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="07…" required /></label>
            </div>
            <label className="pp-field"><span>Email (optional)</span><input type="email" autoComplete="email" value={f.email} onChange={set('email')} /></label>
            <div className="pp-row2">
              <label className="pp-field"><span>County</span><select value={f.county} onChange={set('county')}><option value="">Choose…</option>{COUNTIES.map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="pp-field"><span>Town</span><input value={f.town} onChange={set('town')} /></label>
            </div>
            {f.agent ? <p className="pp-small">Referred by agent <b>{f.agent.toUpperCase()}</b>. They will follow up with you.</p>
              : <label className="pp-field"><span>Agent code (if someone referred you)</span><input value={f.agent} onChange={set('agent')} style={{ textTransform: 'uppercase' }} /></label>}
            <label className="pp-check"><input type="checkbox" checked={f.agree} onChange={set('agree')} required /><span>Pentarch may call or WhatsApp me about this demo. I will not enter real patient records into the demo.</span></label>
            {err && <div className="pp-err">{err}</div>}
            <button className="pp-btn primary block" disabled={busy}>{busy ? 'Setting up your MediCore…' : 'Create my demo'}</button>
            <p className="pp-small center">Prefer a guided demo at your facility? <a href={SITE + '/contact/'}>Book one</a> or call {PHONE}.</p>
          </form>}
        </section>
      </div>
      <footer className="pp-foot">© Pentarch Systems Solutions · <a href={SITE + '/medicore/'}>Pentarch MediCore</a> · <a href="/portal?apply">Become a sales agent</a></footer>
    </div>
  );
}
