import React, { useContext, useEffect, useState } from 'react';
import { api } from '../api';
import { ConfigContext } from '../App';
import { Modal, Field, act, toast, fmtDate, Icon, Badge } from '../ui';

// Thin banner at the top of every page while on trial, in grace, or expired
export function LicenceBanner() {
  const c = useContext(ConfigContext);
  const [l, setL] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (c.user.role !== 'superadmin') api.get('/licence').then(setL).catch(() => {}); }, [c.branch?.id]);
  if (!l || l.status === 'active') return null;
  const admin = c.user.role === 'admin';
  const msg = l.status === 'trial' ? <>Free trial: <b>{l.days_left} day{l.days_left === 1 ? '' : 's'} left</b> (ends {fmtDate(l.trial_ends)}).</>
    : l.status === 'grace' ? <><b>Your {l.was} ended on {fmtDate(l.ends)}.</b> Everything still works for {l.days_left} more day{l.days_left === 1 ? '' : 's'}.</>
    : <><b>Your {l.was} has ended.</b> Records can be viewed, but new entries are paused until a licence key is entered.</>;
  return <div className={'licbar ' + l.status}>
    <Icon name={l.status === 'trial' ? 'info' : 'alert'} size={16} /><span>{msg}</span>
    {admin ? <button className="sm right" onClick={() => setOpen(true)}>Enter licence key</button> : <span className="right small">Ask the administrator to renew.</span>}
    {open && <ActivateKey onClose={() => setOpen(false)} onDone={x => { setL(x); setOpen(false); }} />}
  </div>;
}

export function ActivateKey({ onClose, onDone }) {
  const [key, setKey] = useState('');
  return <Modal title="Enter licence key" onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="primary" disabled={key.length < 20} onClick={async () => { const r = await act(() => api.post('/licence/activate', { key }), 'Licence activated. Thank you!'); onDone(r); }}>Activate</button></>}>
    <p className="muted">Pentarch sends the key by SMS, WhatsApp or email after payment. Paste it here. It works without internet.</p>
    <Field label="Licence key"><textarea rows={4} value={key} onChange={e => setKey(e.target.value)} placeholder="MC1.eyJ…" style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12 }} autoFocus /></Field>
  </Modal>;
}

// Settings → Licence
export function LicencePanel() {
  const [l, setL] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { api.get('/licence').then(setL); }, []);
  if (!l) return null;
  const tone = { active: 'good', trial: 'info', grace: 'warn', expired: 'bad' }[l.status];
  return <div className="stack" style={{ maxWidth: 640 }}>
    <div className="card stack">
      <div className="row"><h3 style={{ margin: 0 }}>Pentarch MediCore licence</h3><Badge tone={tone}>{{ active: 'Active', trial: 'Free trial', grace: 'Renewal due', expired: 'Ended' }[l.status]}</Badge></div>
      {l.status === 'active' && <div className="small">Licensed to <b>{l.licensee}</b> · {l.plan_label} plan · valid until <b>{fmtDate(l.until)}</b> ({l.days_left} days){l.id ? ` · ${l.id}` : ''}</div>}
      {l.status === 'trial' && <div className="small">Free trial with every feature switched on. <b>{l.days_left} days left</b>, ends {fmtDate(l.trial_ends)}.</div>}
      {l.status === 'grace' && <div className="small">Ended {fmtDate(l.ends)}. Everything keeps working for {l.days_left} more days while you renew.</div>}
      {l.status === 'expired' && <div className="small">Ended {fmtDate(l.ends)}. Your records are safe and can be viewed and printed; new entries resume as soon as a key is entered.</div>}
      <div><button className="primary" onClick={() => setOpen(true)}><Icon name="shield" size={15} />{l.status === 'active' ? 'Enter a renewal key' : 'Enter licence key'}</button></div>
    </div>
    <div className="small muted">To buy or renew, contact Pentarch Systems Solutions. Your data always stays on your own computer; the licence only switches new entries on or off.</div>
    {open && <ActivateKey onClose={() => setOpen(false)} onDone={x => { setL(x); setOpen(false); toast('Licence updated'); }} />}
  </div>;
}
