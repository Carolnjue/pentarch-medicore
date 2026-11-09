import React, { useState } from 'react';
import { api } from '../api';
import { useData, Badge, Stat, Modal, Field, Icon, Logo, act, money, fmtDate, Empty, Tip } from '../ui';
import Onboard, { TYPE_ART, TypeCards } from './Onboard';
import { BranchBreakdown } from './Branches';

const TYPE_LABEL = { pharmacy: 'Pharmacy', clinic: 'Clinic', hospital: 'Hospital' };

// Pentarch super admin: every client organisation and branch on this installation
export default function Admin({ session, types, onOpen, onLogout }) {
  const [orgs, reload] = useData('/admin/orgs');
  const [creating, setCreating] = useState(false);
  const [addTo, setAddTo] = useState(null);
  const [del, setDel] = useState(null);
  const [metric, setMetric] = useState(null);
  const [show, setShow] = useState('clients');
  const [q, setQ] = useState('');
  if (creating) return <Onboard types={types} asSuper onCancel={() => setCreating(false)} onDone={r => { setCreating(false); reload(); alert(`Created. The owner signs in with username "${r.admin_username}" and the PIN you set.`); }} />;
  // paying and installed clients first; online demos are kept apart so their sample figures do not inflate the totals
  const isDemo = o => !!o.demo && o.licence?.status !== 'active';
  const counts = { clients: (orgs || []).filter(o => !isDemo(o)).length, demos: (orgs || []).filter(isDemo).length, all: (orgs || []).length };
  const shown = (orgs || []).filter(o => show === 'all' || (show === 'demos') === isDemo(o))
    .filter(o => !q || `${o.name} ${o.owner_name} ${o.phone} ${o.admin}`.toLowerCase().includes(q.toLowerCase()));
  const all = shown.flatMap(o => o.branches);
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'linear-gradient(120deg,#0b1220,#13233f)', color: 'white', padding: '22px 30px' }}>
        <div className="row" style={{ maxWidth: 1300, margin: '0 auto' }}>
          <img src="/pentarch-logo-white.png" alt="Pentarch" style={{ height: 34, width: 'auto' }} /><div><h1 style={{ color: 'white' }}>Pentarch console</h1><span style={{ color: '#94a3b8' }}>Signed in as {session.user.name}. You see every facility on this installation.</span></div>
          <div className="right row"><button className="primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} />New facility</button>
            <button onClick={onLogout}><Icon name="logout" size={15} />Sign out</button></div>
        </div>
      </div>
      <div className="page" style={{ maxWidth: 1300, margin: '0 auto' }}>
        <Tip id="console">Each client organisation can have several branches of different types. <b>Open</b> a branch to work inside it as administrator (for support or demos). Clients only ever see their own facilities.</Tip>
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="seg">{[['clients', 'Clients'], ['demos', 'Online demos'], ['all', 'All']].map(([k, l]) => <button key={k} className={show === k ? 'on' : ''} onClick={() => setShow(k)}>{l} ({counts[k]})</button>)}</div>
          <input placeholder="Search facility, owner, phone or sign-in" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        </div>
        <div className="grid g4" style={{ marginBottom: 18 }}>
          <Stat icon="branches" label="Organisations" value={shown.length} hint={show === 'demos' ? 'Online demos' : show === 'clients' ? 'Client accounts' : 'Clients and demos'} onClick={() => document.getElementById('orgs')?.scrollIntoView({ behavior: 'smooth' })} />
          <Stat icon="grid" label="Branches" value={all.length} hint={['pharmacy', 'clinic', 'hospital'].map(t => `${all.filter(b => b.type === t).length} ${t}`).join(' · ')} onClick={() => setMetric('money')} />
          <Stat icon="patients" label="Patients on file" value={all.reduce((a, b) => a + b.patients, 0).toLocaleString()} onClick={() => setMetric('patients')} />
          <Stat icon="cash" label="Collections, 30 days" value={money(all.reduce((a, b) => a + b.revenue30, 0))} onClick={() => setMetric('money')} />
        </div>
        {orgs && !shown.length && <div className="card"><Empty icon="branches">{orgs.length ? 'Nothing matches. Try another tab or search.' : <>No facilities yet. Click <b>New facility</b> to set up the first client.</>}</Empty></div>}
        {metric && <BranchBreakdown metric={metric} B={all} onOpen={id => { setMetric(null); onOpen(id); }} onClose={() => setMetric(null)} />}
        <div className="stack" id="orgs">{shown.slice(0, 60).map(o => <div key={o.id} className="card">
          <div className="cardhead"><h2>{o.name}</h2>{isDemo(o) && <Badge tone="info">online demo{o.licence?.days_left != null ? ` · ${o.licence.days_left} days left` : ''}</Badge>}<span className="muted small">Owner {o.owner_name} · {o.phone} {o.email && `· ${o.email}`} · admin sign-in <b>{o.admin}</b> · {o.users} users · since {fmtDate(o.created_at)}</span>
            <div className="right row"><button className="sm" onClick={() => setAddTo(o)}><Icon name="plus" size={14} />Add branch</button>
              <button className="sm danger" onClick={() => setDel(o)}>Remove</button></div></div>
          <div className="tablewrap" style={{ boxShadow: 'none' }}><table className="table">
            <thead><tr><th>Branch</th><th>Type</th><th className="num">Patients</th><th className="num">Today</th><th className="num">30 days</th><th className="num">In queue</th><th className="num">Low stock</th><th /></tr></thead>
            <tbody>{o.branches.map(b => <tr key={b.id}>
              <td><b>{b.name}</b> {b.sample ? <Badge tone="warn">sample data</Badge> : null}<div className="faint small">{b.location}</div></td>
              <td><span className="badge" style={{ background: TYPE_ART[b.type]?.bg, color: TYPE_ART[b.type]?.color }}>{TYPE_LABEL[b.type]}</span></td>
              <td className="num">{b.patients}</td><td className="num">{money(b.revenueToday)}</td><td className="num">{money(b.revenue30)}</td>
              <td className="num">{b.inQueue}</td><td className="num">{b.lowStock ? <Badge tone="warn">{b.lowStock}</Badge> : 0}</td>
              <td><button className="sm primary" onClick={() => onOpen(b.id)}>Open</button></td></tr>)}</tbody>
          </table></div>
        </div>)}{shown.length > 60 && <p className="muted small">Showing the newest 60 of {shown.length}. Search to find others.</p>}</div>
      </div>
      {addTo && <NewBranch org={addTo} types={types} onClose={() => setAddTo(null)} onDone={() => { setAddTo(null); reload(); }} />}
      {del && <ConfirmDelete org={del} onClose={() => setDel(null)} onDone={() => { setDel(null); reload(); }} />}
    </div>
  );
}

export function NewBranch({ org, types, onClose, onDone }) {
  const [f, setF] = useState({ type: 'pharmacy', sample: false });
  const save = async () => {
    const r = await act(() => api.post('/org/branches', { ...f, org_id: org?.id, options: { ...types[f.type].defaults } }), 'Branch created');
    onDone(r);
  };
  return <Modal wide title={`New branch${org ? ' · ' + org.name : ''}`} onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="primary" disabled={!f.name} onClick={save}>Create branch</button></>}>
    <div className="stack">
      <TypeCards value={f.type} onPick={t => setF({ ...f, type: t })} />
      <div className="fields">
        <Field label="Branch name *"><input value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. SPENSA Pharmacy - Rongai" /></Field>
        <Field label="Location"><input value={f.location || ''} onChange={e => setF({ ...f, location: e.target.value })} /></Field>
        <Field label="Phone"><input value={f.phone || ''} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="Same as main if blank" /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={f.sample} onChange={e => setF({ ...f, sample: e.target.checked })} />Load sample data for training</label>
      <p className="faint small">The new branch gets its own patients, stock and money records. The owner sees all branches together on the <b>All branches</b> page. Services can be changed in the branch's Settings.</p>
    </div>
  </Modal>;
}

function ConfirmDelete({ org, onClose, onDone }) {
  const [t, setT] = useState('');
  const go = async () => { await act(() => api.del('/admin/orgs/' + org.id), 'Organisation removed'); onDone(); };
  return <Modal title={`Remove ${org.name}?`} onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="danger solid" disabled={t !== org.name} onClick={go}>Remove</button></>}>
    <p>This removes the organisation, its users and access to its branches from this installation. Branch data files stay in the <code>data/branches</code> folder as a backup.</p>
    <div className="mt"><Field label={`Type "${org.name}" to confirm`}><input value={t} onChange={e => setT(e.target.value)} /></Field></div>
  </Modal>;
}
