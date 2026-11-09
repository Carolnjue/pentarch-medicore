import React, { useContext, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { api } from '../api';
import { ConfigContext } from '../App';
import { useData, Modal, Field, Badge, act, money, fmtDT, age, Empty, PatientPicker, Tabs } from '../ui';

export default function Wards() {
  const c = useContext(ConfigContext);
  const [wards, reload] = useData('/wards');
  const [open, setOpen] = useState(null);
  const [admitBed, setAdmitBed] = useState(null);
  if (!wards) return <div className="page">Loading…</div>;
  const total = wards.reduce((a, w) => a + w.beds.length, 0);
  const occ = wards.reduce((a, w) => a + w.beds.filter(b => b.admission_id).length, 0);
  const days = t => Math.max(1, Math.ceil((Date.now() - new Date(t)) / 864e5));
  return (
    <div className="page">
      <div className="pagehead">
        <div><h1>Wards & beds</h1><p className="sub">{occ} of {total} beds occupied ({Math.round(occ / Math.max(1, total) * 100)}%). Click a bed to manage the patient or admit.</p></div>
        <div className="actions"><button onClick={async () => { const r = await act(() => api.post('/wards/charge')); alert(`${r.posted} bed-day charge(s) posted to interim bills.`); }}>Post today's bed charges</button></div>
      </div>
      <div className="stack">{wards.map(w => <div key={w.id} className="card">
        <div className="cardhead"><h3>{w.name}</h3><span className="muted small">{money(w.daily_rate)} per day</span>
          <span className="right"><Badge tone="info">{w.beds.filter(b => b.admission_id).length} / {w.beds.length} occupied</Badge></span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {w.beds.map(b => b.admission_id
            ? <button key={b.id} className="choice on" style={{ padding: 10 }} onClick={() => setOpen(b)}><b className="small">{b.label} · {b.pname}</b>
              <span className="small muted">{b.sex} · {age(b.dob)} · day {days(b.admitted_at)}</span><div className="small" style={{ marginTop: 2 }}>{b.reason}</div></button>
            : <button key={b.id} className="choice" style={{ padding: 10, borderStyle: 'dashed' }} onClick={() => setAdmitBed(b)}><b className="small">{b.label}</b><span className="small faint">Free · admit</span></button>)}
        </div>
      </div>)}</div>
      {open && <AdmissionPanel bed={open} wards={wards} maternity={c.maternity} onClose={() => { setOpen(null); reload(); }} />}
      {admitBed && <AdmitHere bed={admitBed} onClose={() => setAdmitBed(null)} onDone={() => { setAdmitBed(null); reload(); }} />}
    </div>
  );
}

function AdmitHere({ bed, onClose, onDone }) {
  const [p, setP] = useState(null);
  const [reason, setReason] = useState('');
  const go = async () => {
    const v = await act(() => api.post('/visits', { patient_id: p.id, type: 'IPD', complaint: reason }));
    await act(() => api.post(`/visits/${v.id}/admit`, { bed_id: bed.id, reason }), `Admitted to ${bed.label}`);
    onDone();
  };
  return <Modal title={`Admit to bed ${bed.label}`} onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="primary" disabled={!p || !reason} onClick={go}>Admit</button></>}>
    {!p ? <PatientPicker onPick={setP} /> : <p><b>{p.first_name} {p.last_name}</b> <span className="faint">{p.mrn}</span> <button className="sm" onClick={() => setP(null)}>Change</button></p>}
    <div className="mt"><Field label="Reason for admission"><input value={reason} onChange={e => setReason(e.target.value)} /></Field></div>
  </Modal>;
}

function AdmissionPanel({ bed, wards, maternity, onClose }) {
  const c = useContext(ConfigContext);
  const [a, reload] = useData('/admissions/' + bed.admission_id);
  const [note, setNote] = useState('');
  const [discharge, setDischarge] = useState(null);
  const [transfer, setTransfer] = useState(false);
  const [tab, setTab] = useState('obs');
  if (!a) return null;
  const free = wards.flatMap(w => w.beds.filter(b => !b.admission_id).map(b => ({ ...b, ward: w.name })));
  const addNote = async () => { await act(() => api.post(`/admissions/${a.id}/note`, { note }), 'Note added'); setNote(''); reload(); };
  const isLabour = maternity && /labou?r/i.test(a.reason || '');
  const days = Math.max(1, Math.ceil((Date.now() - new Date(a.admitted_at)) / 864e5));
  const draft = () => [
    `Diagnosis: ${a.diagnosis ? `${a.diagnosis.diagnosis} (${a.diagnosis.dx_code || ''})` : ''}`,
    `Reason for admission: ${a.reason || ''}`,
    `Treatment given: ${a.meds.map(m => m.name).join(', ')}`,
    'Condition on discharge: ',
    'Medicines to take home: ',
    'Follow-up: ',
  ].join('\n');
  return <Modal wide title={`${bed.pname} · ${a.ward} ${a.bed}`} onClose={onClose} footer={<>
    <button onClick={() => (window.location.hash = '#/visit/' + a.visit_id)}>Open clinical record</button>
    <button onClick={() => setTransfer(true)}>Transfer bed</button>
    <button className="primary" onClick={() => setDischarge(draft())}>Discharge</button></>}>
    <div className="row" style={{ marginBottom: 12 }}><Badge tone="info">Admitted {fmtDT(a.admitted_at)} · day {days}</Badge><span>{a.reason}</span>
      {a.patient?.allergies && <Badge tone="bad">Allergy: {a.patient.allergies}</Badge>}
      <span className="right muted small">{money(a.daily_rate)} / day · bed charges post daily to the interim bill</span></div>
    {isLabour && <Partograph admissionId={a.id} />}
    <Tabs value={tab} onChange={setTab} tabs={[['obs', `Observations (${a.vitals.length})`], ['meds', `Medicines (${a.meds.length})`], ['notes', `Nursing notes (${a.notes.length})`]]} />
    {tab === 'obs' && <Observations a={a} reload={reload} />}
    {tab === 'meds' && <MedChart a={a} reload={reload} />}
    {tab === 'notes' && <>
      <div className="row" style={{ margin: '8px 0' }}><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. 14:00 IV fluids running, patient comfortable, mother at bedside" /><button className="primary" disabled={!note} onClick={addNote}>Add</button></div>
      <div className="timeline">{a.notes.map(n => <div key={n.id} className="ev"><div className="small faint">{fmtDT(n.created_at)} · {n.by_user}</div>{n.note}</div>)}</div>
      {!a.notes.length && <Empty icon="list">No nursing notes yet.</Empty>}
    </>}
    {transfer && <div className="card mt"><b>Transfer to:</b><div className="row mt">{free.map(b => <button key={b.id} className="sm" onClick={async () => { await act(() => api.post(`/admissions/${a.id}/transfer`, { bed_id: b.id }), 'Transferred'); onClose(); }}>{b.ward} · {b.label}</button>)}</div></div>}
    {discharge !== null && <Modal title="Discharge summary" onClose={() => setDischarge(null)} footer={<><button onClick={() => printDischarge(a, discharge, c)}>Print</button><button className="primary" onClick={async () => {
      const r = await act(() => api.post(`/admissions/${a.id}/discharge`, { summary: discharge }), 'Discharged. Final bill is ready at the cashier.');
      printDischarge(a, discharge, c);
      window.location.hash = '#/visit/' + r.visit_id;
    }}>Discharge, print and send to cashier</button></>}>
      <p className="small muted">Filled in from the record. Complete the condition on discharge, medicines to take home and follow-up date.</p>
      <Field label="Discharge summary"><textarea style={{ minHeight: 200 }} value={discharge} onChange={e => setDischarge(e.target.value)} /></Field>
    </Modal>}
  </Modal>;
}

// Ward observations: quick entry and a chart of the readings, abnormal values flagged
const OBS = [['temp', 'Temp °C', 36, 37.5], ['pulse', 'Pulse', 60, 100], ['resp', 'Resp /min', 12, 20], ['sys', 'BP sys', 90, 140], ['dia', 'BP dia', 60, 90], ['spo2', 'SpO₂ %', 94, 100]];
function Observations({ a, reload }) {
  const [f, setF] = useState({});
  const save = async () => { await act(() => api.post(`/visits/${a.visit_id}/vitals`, f), 'Observations saved'); setF({}); reload(); };
  const off = (k, v) => { const o = OBS.find(x => x[0] === k); return v != null && o && (v < o[2] || v > o[3]); };
  return <div className="stack" style={{ marginTop: 10 }}>
    <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {OBS.map(([k, l]) => <Field key={k} label={l}><input type="number" step="any" style={{ width: 92 }} value={f[k] ?? ''} onChange={e => setF({ ...f, [k]: e.target.value })} /></Field>)}
      <button className="primary" disabled={!Object.values(f).some(x => x !== '')} onClick={save}>Save</button>
    </div>
    {a.vitals.length ? <div className="tablewrap"><table className="table"><thead><tr><th>Time</th>{OBS.map(o => <th key={o[0]} className="num">{o[1]}</th>)}<th>By</th></tr></thead>
      <tbody>{a.vitals.map(v => <tr key={v.id}><td className="nowrap">{fmtDT(v.created_at)}</td>{OBS.map(([k]) => <td key={k} className="num" style={off(k, v[k]) ? { color: 'var(--bad)', fontWeight: 700 } : null}>{v[k] ?? '-'}</td>)}<td className="small faint">{v.recorded_by}</td></tr>)}</tbody></table></div>
      : <Empty icon="heart">No observations yet. Record the first set above.</Empty>}
  </div>;
}

// Medicine administration record: every dose given, withheld or refused, by whom and when
function MedChart({ a, reload }) {
  const [why, setWhy] = useState(null);
  const give = async (m, status = 'given', reason) => { await act(() => api.post(`/admissions/${a.id}/med`, { prescription_id: m.id, status, reason }), status === 'given' ? `${m.name}: dose recorded` : 'Recorded'); setWhy(null); reload(); };
  const PER = { OD: 1, BD: 2, TDS: 3, QID: 4, Nocte: 1, Stat: 1 };
  if (!a.meds.length) return <Empty icon="pharmacy">No medicines prescribed. Prescribe from the clinical record (Orders & prescriptions).</Empty>;
  return <div className="stack" style={{ marginTop: 10 }}>
    <div className="tablewrap"><table className="table"><thead><tr><th>Medicine</th><th>Dose</th><th>How often</th><th className="num">Doses given</th><th>Last given</th><th /></tr></thead>
      <tbody>{a.meds.map(m => { const total = (PER[m.frequency] || 0) * (m.days || 1); const done = total && m.given >= total;
        const gap = 24 / (PER[m.frequency] || 24), next = m.last_given ? new Date(new Date(m.last_given).getTime() + gap * 3600e3) : null, early = next && next - Date.now() > gap * 0.25 * 3600e3;
        return <tr key={m.id}><td><b>{m.name}</b>{m.status !== 'dispensed' && <div className="small" style={{ color: 'var(--warn, #b45309)' }}>Not yet issued by the pharmacy</div>}</td><td>{m.dose}</td><td>{m.frequency} · {m.days} d</td>
          <td className="num">{m.given}{total ? ` / ${total}` : ''}</td><td className="small">{m.last_given ? fmtDT(m.last_given) : '-'}{early && <div style={{ color: 'var(--warn, #b45309)' }}>Next due {next.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</div>}</td>
          <td className="nowrap">{done ? <Badge tone="good">Course complete</Badge> : <><button className={'sm' + (early ? '' : ' primary')} onClick={() => (!early || window.confirm(`${m.name} is not due until ${next.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}. Record a dose now anyway?`)) && give(m)}>Given</button><button className="sm" onClick={() => setWhy({ m, status: 'withheld', reason: '' })}>Not given</button></>}</td></tr>; })}</tbody></table></div>
    {why && <div className="card"><b>{why.m.name}: dose not given</b><div className="row mt">
      <select value={why.status} onChange={e => setWhy({ ...why, status: e.target.value })} style={{ width: 'auto' }}><option value="withheld">Withheld</option><option value="refused">Patient refused</option></select>
      <input placeholder="Reason, e.g. nil by mouth for theatre, vomiting, BP low" value={why.reason} onChange={e => setWhy({ ...why, reason: e.target.value })} />
      <button className="primary" disabled={!why.reason.trim()} onClick={() => give(why.m, why.status, why.reason)}>Save</button><button onClick={() => setWhy(null)}>Cancel</button></div></div>}
    {a.mar.length > 0 && <><h4 className="mt">Recent doses</h4><div className="timeline">{a.mar.slice(0, 12).map(x => <div key={x.id} className="ev"><div className="small faint">{fmtDT(x.at)} · {x.by_user}</div>
      {x.status === 'given' ? <>{x.name} {x.dose} <b>given</b></> : <>{x.name} <b style={{ color: 'var(--bad)' }}>{x.status}</b>: {x.reason}</>}</div>)}</div></>}
  </div>;
}

function printDischarge(a, text, c) {
  const w = window.open('', '_blank', 'width=760,height=900'); if (!w) return;
  const esc = t => String(t || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  w.document.write(`<html><head><title>Discharge summary</title><style>body{font:14px/1.5 Arial;margin:32px;color:#111}h1{font-size:18px;margin:0}h2{font-size:16px;margin:18px 0 6px}.m{color:#555}pre{white-space:pre-wrap;font:14px/1.6 Arial}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #ddd;padding:4px 6px}</style></head><body>
  <h1>${esc(c.facility_name)}</h1><div class="m">${esc(c.location || '')} ${c.phone ? '· Tel ' + esc(c.phone) : ''}</div>
  <h2>Discharge summary</h2>
  <table><tr><td>Patient</td><td><b>${esc(a.patient?.first_name)} ${esc(a.patient?.last_name)}</b> · ${esc(a.patient?.mrn)} · ${esc(a.patient?.sex)}</td></tr>
  <tr><td>Ward and bed</td><td>${esc(a.ward)} · ${esc(a.bed)}</td></tr><tr><td>Admitted</td><td>${new Date(a.admitted_at).toLocaleString('en-KE')}</td></tr><tr><td>Discharged</td><td>${new Date().toLocaleString('en-KE')}</td></tr>
  ${a.patient?.allergies ? `<tr><td>Allergies</td><td><b>${esc(a.patient.allergies)}</b></td></tr>` : ''}</table>
  <h2>Summary</h2><pre>${esc(text)}</pre>
  <p style="margin-top:40px">Clinician: ______________________ &nbsp; Signature: ____________ &nbsp; Date: ________</p>
  <p class="m">Come back at once if you feel worse, the fever returns, or you are worried.</p>
  <script>print()</script></body></html>`);
  w.document.close();
}

// WHO partograph: active labour from 4 cm; alert line at 1 cm/hour, action line 4 hours to its right
function Partograph({ admissionId }) {
  const [rows, reload] = useData(`/admissions/${admissionId}/partograph`);
  const [f, setF] = useState({});
  if (!rows) return null;
  const t0 = rows[0] ? new Date(rows[0].at).getTime() : Date.now();
  const start = rows[0]?.dilation || 4;
  const pts = rows.map(r => ({ h: Math.round((new Date(r.at) - t0) / 360e3) / 10, dilation: r.dilation, fhr: r.fhr }));
  const alertLine = [{ h: 0, alert: start }, { h: 10 - start, alert: 10 }];
  const actionLine = [{ h: 4, action: start }, { h: 14 - start, action: 10 }];
  const last = pts[pts.length - 1];
  const behind = last && last.dilation < start + last.h;
  const save = async () => { await act(() => api.post(`/admissions/${admissionId}/partograph`, f), 'Partograph updated'); setF({}); reload(); };
  return <div className="card" style={{ background: '#faf5ff' }}>
    <div className="cardhead"><h3>Partograph</h3>{last && <Badge tone={behind ? 'warn' : 'good'}>{behind ? 'Crossed alert line - review progress' : 'Progress normal'}</Badge>}
      <span className="right faint small">Cervical dilation (cm) vs hours in active labour</span></div>
    <div style={{ height: 230 }}>
      <ResponsiveContainer>
        <LineChart margin={{ left: 0, right: 16 }}>
          <CartesianGrid stroke="#e9d5ff" />
          <XAxis type="number" dataKey="h" domain={[0, 12]} ticks={[0, 2, 4, 6, 8, 10, 12]} fontSize={11.5} unit="h" />
          <YAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} fontSize={11.5} width={30} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line data={alertLine} dataKey="alert" name="Alert line" stroke="#f59e0b" strokeDasharray="5 4" dot={false} />
          <Line data={actionLine} dataKey="action" name="Action line" stroke="#dc2626" strokeDasharray="5 4" dot={false} />
          <Line data={pts} dataKey="dilation" name="Dilation (cm)" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 5, fill: '#7c3aed' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="fields mt" style={{ gridTemplateColumns: 'repeat(5, 1fr) auto', alignItems: 'end' }}>
      <Field label="Dilation (cm)"><input type="number" value={f.dilation || ''} onChange={e => setF({ ...f, dilation: e.target.value })} /></Field>
      <Field label="Fetal HR"><input type="number" value={f.fhr || ''} onChange={e => setF({ ...f, fhr: e.target.value })} /></Field>
      <Field label="Contractions /10 min"><input type="number" value={f.contractions || ''} onChange={e => setF({ ...f, contractions: e.target.value })} /></Field>
      <Field label="BP sys"><input type="number" value={f.sys || ''} onChange={e => setF({ ...f, sys: e.target.value })} /></Field>
      <Field label="BP dia"><input type="number" value={f.dia || ''} onChange={e => setF({ ...f, dia: e.target.value })} /></Field>
      <button className="primary" disabled={!f.dilation} onClick={save}>Plot</button>
    </div>
    <p className="faint small mt">Latest: {rows.length ? `${last.dilation} cm, FHR ${last.fhr}` : 'none'} · record delivery from the Maternity page.</p>
  </div>;
}
