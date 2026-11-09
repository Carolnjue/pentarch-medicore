import React, { useContext, useMemo, useState } from 'react';
import { api } from '../api';
import { ConfigContext } from '../App';
import { useData, Modal, Field, Badge, act, toast, money, fmtDT, fmtDate, Empty, Icon, Tip, todayISO, StatusBadge } from '../ui';
import ProductArt from '../shared/ProductArt';
import { Barcode, barcodeSvg, printLabelSheet, parseGS1 } from '../shared/barcode';

const PO_STATUS = { draft: ['Draft', ''], sent: ['Sent to supplier', 'info'], partial: ['Part received', 'warn'], received: ['Received', 'good'], cancelled: ['Cancelled', 'bad'] };

// Search box for items, used on several screens
export function ItemSearch({ items, onPick, placeholder = 'Search item or scan barcode' }) {
  const [q, setQ] = useState('');
  const m = q.length > 1 ? items.filter(i => (i.name + ' ' + (i.code || '') + ' ' + (i.barcode || '')).toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const enter = async e => {
    if (e.key !== 'Enter' || !q.trim()) return;
    const r = await api.get('/items/by-code/' + encodeURIComponent(q.trim())).catch(() => null);
    if (r?.item) { onPick(items.find(i => i.id === r.item.id) || r.item, r.gs1); setQ(''); }
    else if (m.length === 1) { onPick(m[0]); setQ(''); }
  };
  return <div style={{ position: 'relative' }}>
    <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={enter} placeholder={placeholder} />
    {m.length > 0 && <div className="dropdown">{m.map(i => <button key={i.id} className="dd-item" onClick={() => { onPick(i); setQ(''); }}><ProductArt item={i} size={30} rounded={6} /><span>{i.name} <span className="faint small">· {i.stock_text}</span></span></button>)}</div>}
  </div>;
}

// ================= purchase orders =================
export function PurchaseOrders() {
  const [list, reload] = useData('/purchase-orders');
  const [items] = useData('/items');
  const [make, setMake] = useState(null);
  const [open, setOpen] = useState(null);
  const startFromReorder = async () => {
    const sug = await api.get('/purchase-orders-suggest');
    if (!sug.length) return toast('Nothing is below its reorder level right now');
    const sup = Object.entries(sug.reduce((a, x) => (a[x.supplier || ''] = (a[x.supplier || ''] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1])[0][0];
    setMake({ supplier: sup || '', lines: sug.map(s => ({ item_id: s.item_id, name: s.name, packs: s.packs, pack_cost: s.pack_cost, pack_name: s.pack_name, pack_size: s.pack_size, note: `${s.stock_text} left, reorder at ${s.reorder_text}` })) });
  };
  return <div className="stack">
    <div className="row"><button className="primary" onClick={startFromReorder}><Icon name="alert" size={15} />Order what is running low</button><button onClick={() => setMake({ supplier: '', lines: [] })}><Icon name="plus" size={15} />Blank order</button>
      <span className="faint small">Orders list what you expect; receive against them when the delivery arrives.</span></div>
    <div className="tablewrap"><table className="table"><thead><tr><th>Order</th><th>Supplier</th><th>Created</th><th>Lines</th><th className="num">Value</th><th>Status</th></tr></thead>
      <tbody>{(list || []).map(p => <tr key={p.id} className="click" onClick={() => setOpen(p.id)}><td><b>{p.po_no}</b></td><td>{p.supplier}</td><td className="small">{fmtDT(p.created_at)} · {p.created_by}</td><td>{p.lines.length}</td><td className="num">{money(p.total)}</td>
        <td><Badge tone={PO_STATUS[p.status]?.[1]}>{PO_STATUS[p.status]?.[0] || p.status}</Badge></td></tr>)}</tbody></table>
      {list && !list.length && <Empty icon="box">No purchase orders yet. “Order what is running low” builds one from the reorder list.</Empty>}</div>
    {make && items && <NewPO init={make} items={items} onClose={() => setMake(null)} onDone={id => { setMake(null); reload(); setOpen(id); }} />}
    {open && <PODetail id={open} onClose={() => { setOpen(null); reload(); }} />}
  </div>;
}

function NewPO({ init, items, onClose, onDone }) {
  const [suppliers] = useData('/suppliers');
  const [f, setF] = useState(init);
  const total = f.lines.reduce((a, l) => a + (Number(l.packs) || 0) * (Number(l.pack_cost) || 0), 0);
  const set = (i, k, v) => setF({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, [k]: v } : l) });
  return <Modal xl title="New purchase order" onClose={onClose} footer={<><span className="muted">Total {money(total)}</span><button onClick={onClose}>Cancel</button><button className="primary" disabled={!f.supplier || !f.lines.length} onClick={async () => { const r = await act(() => api.post('/purchase-orders', f), 'Order saved'); onDone(r.id); }}>Save order</button></>}>
    <div className="fields"><Field label="Supplier *"><input list="sup-list" value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })} /><datalist id="sup-list">{(suppliers || []).map(s => <option key={s.id} value={s.name} />)}</datalist></Field>
      <Field label="Expected delivery"><input type="date" value={f.expected || ''} onChange={e => setF({ ...f, expected: e.target.value })} /></Field>
      <Field label="Notes"><input value={f.notes || ''} onChange={e => setF({ ...f, notes: e.target.value })} /></Field></div>
    <div className="mt"><ItemSearch items={items} onPick={i => setF({ ...f, lines: [...f.lines, { item_id: i.id, name: i.name, packs: 1, pack_cost: Math.round((i.cost || 0) * i.pack_size), pack_name: i.pack_name, pack_size: i.pack_size, note: `${i.stock_text} in stock` }] })} placeholder="Add an item: search or scan" /></div>
    <table className="table mt"><thead><tr><th>Item</th><th style={{ width: 110 }}>Quantity</th><th style={{ width: 140 }}>Cost each</th><th className="num">Line total</th><th /></tr></thead>
      <tbody>{f.lines.map((l, i) => <tr key={i}><td><b>{l.name}</b><div className="faint small">{l.note}</div></td>
        <td><input type="number" min="1" value={l.packs} onChange={e => set(i, 'packs', e.target.value)} /><div className="faint small">{l.pack_size > 1 ? `${l.pack_name}s of ${l.pack_size}` : l.pack_name}</div></td>
        <td><input type="number" value={l.pack_cost} onChange={e => set(i, 'pack_cost', e.target.value)} /></td>
        <td className="num">{money((Number(l.packs) || 0) * (Number(l.pack_cost) || 0))}</td><td><button className="ghost sm" onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })}>✕</button></td></tr>)}</tbody></table>
    {!f.lines.length && <Empty icon="box">Add the items to order.</Empty>}
  </Modal>;
}

function PODetail({ id, onClose }) {
  const c = useContext(ConfigContext);
  const [po, reload] = useData('/purchase-orders/' + id);
  const [recv, setRecv] = useState(null);
  if (!po) return null;
  const text = `PURCHASE ORDER ${po.po_no}\nFrom: ${c.facility_name}, ${c.location || ''} Tel ${c.phone || ''}\nTo: ${po.supplier}\n\n` + po.lines.map(l => `- ${l.packs} ${l.pack_size > 1 ? l.pack_name + 's of ' + l.pack_size : l.pack_name} ${l.name}`).join('\n') + `\n\nPlease confirm availability and price. Thank you.`;
  const share = () => { navigator.clipboard?.writeText(text).then(() => toast('Order copied. Paste it into WhatsApp or email to the supplier.'), () => {}); };
  const canReceive = ['draft', 'sent', 'partial'].includes(po.status);
  return <Modal xl title={`${po.po_no} · ${po.supplier}`} onClose={onClose} footer={<>
    {po.status === 'draft' && <button onClick={async () => { await act(() => api.post(`/purchase-orders/${id}/status`, { status: 'sent' }), 'Marked as sent'); reload(); }}>Mark as sent</button>}
    {canReceive && <button className="danger" onClick={async () => { await act(() => api.post(`/purchase-orders/${id}/status`, { status: 'cancelled' }), 'Order cancelled'); reload(); }}>Cancel order</button>}
    <button onClick={share}>Copy for WhatsApp / email</button><button onClick={() => window.print()}><Icon name="print" size={15} />Print</button>
    {canReceive && <button className="primary" onClick={() => setRecv(po.lines.map(l => ({ line_id: l.id, name: l.name, pack_name: l.pack_name, pack_size: l.pack_size, packs: Math.max(0, Math.round((l.packs * l.pack_size - l.received) / l.pack_size)), pack_cost: l.pack_cost, batch_no: '', expiry: '' })))}>Receive delivery</button>}</>}>
    <div className="printable">
      <div className="row"><Badge tone={PO_STATUS[po.status]?.[1]}>{PO_STATUS[po.status]?.[0]}</Badge><span className="faint small">Created {fmtDT(po.created_at)} by {po.created_by}{po.sent_at ? ` · sent ${fmtDate(po.sent_at)}` : ''}</span></div>
      <table className="table mt"><thead><tr><th>Item</th><th className="num">Ordered</th><th className="num">Received</th><th className="num">Cost each</th><th className="num">Total</th><th>In stock now</th></tr></thead>
        <tbody>{po.lines.map(l => <tr key={l.id}><td><b>{l.name}</b><div className="faint small">{l.code}</div></td><td className="num">{l.packs} {l.pack_size > 1 ? l.pack_name + (l.packs === 1 ? '' : 's') : l.pack_name}</td>
          <td className="num">{l.received ? l.received_text : '-'}</td><td className="num">{money(l.pack_cost)}</td><td className="num">{money(l.total)}</td><td className="small">{l.stock_text}</td></tr>)}
          <tr><td colSpan={4}><b>Total</b></td><td className="num"><b>{money(po.total)}</b></td><td /></tr></tbody></table>
    </div>
    {recv && <Modal xl title={`Receive ${po.po_no}`} onClose={() => setRecv(null)} footer={<><button onClick={() => setRecv(null)}>Cancel</button><button className="primary" onClick={async () => { await act(() => api.post(`/purchase-orders/${id}/receive`, { lines: recv, invoice: recv.invoice }), 'Delivery received into stock'); setRecv(null); reload(); }}>Receive into stock</button></>}>
      <Tip id="grn">Check each item against the delivery note. Scan the 2D code on the pack to fill in the batch and expiry automatically. Leave quantity 0 for anything that did not come.</Tip>
      <Field label="Supplier invoice number"><input value={recv.invoice || ''} onChange={e => { const r = [...recv]; r.invoice = e.target.value; setRecv(r); }} style={{ maxWidth: 240 }} /></Field>
      <table className="table mt"><thead><tr><th>Item</th><th style={{ width: 90 }}>Packs</th><th style={{ width: 120 }}>Cost each</th><th>Scan pack (optional)</th><th style={{ width: 130 }}>Batch</th><th style={{ width: 160 }}>Expiry *</th></tr></thead>
        <tbody>{recv.map((l, i) => { const set = (k, v) => { const r = recv.map((x, j) => j === i ? { ...x, [k]: v } : x); r.invoice = recv.invoice; setRecv(r); };
          return <tr key={l.line_id}><td><b>{l.name}</b><div className="faint small">{l.pack_size > 1 ? `${l.pack_name} of ${l.pack_size}` : l.pack_name}</div></td>
            <td><input type="number" min="0" value={l.packs} onChange={e => set('packs', e.target.value)} /></td><td><input type="number" value={l.pack_cost} onChange={e => set('pack_cost', e.target.value)} /></td>
            <td><input placeholder="Scan 2D code" onKeyDown={e => { if (e.key === 'Enter') { const g = parseGS1(e.target.value); if (g) { const r = recv.map((x, j) => j === i ? { ...x, batch_no: g.batch || x.batch_no, expiry: g.expiry || x.expiry } : x); r.invoice = recv.invoice; setRecv(r); toast('Batch and expiry read from the pack'); } e.target.value = ''; } }} /></td>
            <td><input value={l.batch_no} onChange={e => set('batch_no', e.target.value)} /></td><td><input type="date" min={todayISO()} value={l.expiry} onChange={e => set('expiry', e.target.value)} /></td></tr>; })}</tbody></table>
    </Modal>}
  </Modal>;
}

// ================= transfers between branches =================
export function Transfers() {
  const c = useContext(ConfigContext);
  const [list, reload] = useData('/transfers');
  const [items] = useData('/items');
  const [make, setMake] = useState(null);
  const mine = Number(c.branch?.id ?? c.branch);
  const myOrg = (c.branches || []).find(b => b.id === mine)?.org_id;
  const others = (c.branches || []).filter(b => b.id !== mine && b.org_id === myOrg);
  return <div className="stack">
    <Tip id="transfers">Move stock between your branches. The sending branch's stock drops when you send; the receiving branch confirms on arrival and the same batches and expiry dates appear there.</Tip>
    <div className="row">{others.length ? <button className="primary" onClick={() => setMake({ to_branch: others[0].id, lines: [] })}><Icon name="branches" size={15} />Send stock to another branch</button> : <span className="muted">Add a second branch to move stock between branches.</span>}</div>
    <div className="tablewrap"><table className="table"><thead><tr><th>Transfer</th><th>From → To</th><th>Items</th><th>Sent</th><th>Status</th><th /></tr></thead>
      <tbody>{(list || []).map(t => <tr key={t.id}><td><b>TRF{t.id}</b></td><td>{t.from_name} → {t.to_name}</td><td className="small">{t.lines.map(l => `${l.qty_text} ${l.name}`).join('; ')}</td>
        <td className="small">{fmtDT(t.created_at)} · {t.created_by}</td>
        <td>{t.status === 'in_transit' ? <Badge tone="warn">In transit</Badge> : t.status === 'received' ? <Badge tone="good">Received {fmtDate(t.received_at)}</Badge> : <Badge tone="bad">Cancelled</Badge>}</td>
        <td>{t.status === 'in_transit' && (t.to_branch === mine ? <button className="primary sm" onClick={async () => { await act(() => api.post(`/transfers/${t.id}/receive`), 'Received into stock'); reload(); }}>Confirm received</button>
          : <button className="sm" onClick={async () => { await act(() => api.post(`/transfers/${t.id}/cancel`), 'Transfer cancelled, stock returned'); reload(); }}>Cancel</button>)}</td></tr>)}</tbody></table>
      {list && !list.length && <Empty icon="branches">No transfers yet.</Empty>}</div>
    {make && items && <Modal wide title="Send stock to another branch" onClose={() => setMake(null)} footer={<><button onClick={() => setMake(null)}>Cancel</button><button className="primary" disabled={!make.lines.length} onClick={async () => { await act(() => api.post('/transfers', make), 'Stock sent. The other branch confirms when it arrives.'); setMake(null); reload(); }}>Send</button></>}>
      <Field label="Send to"><select value={make.to_branch} onChange={e => setMake({ ...make, to_branch: Number(e.target.value) })}>{others.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
      <div className="mt"><ItemSearch items={items.filter(i => i.stock > 0)} onPick={i => setMake({ ...make, lines: [...make.lines, { item_id: i.id, name: i.name, qty: 1, mode: i.pack_size > 1 ? 'pack' : 'unit', item: i }] })} /></div>
      <table className="table mt"><tbody>{make.lines.map((l, i) => <tr key={i}><td><b>{l.name}</b><div className="faint small">{l.item.stock_text} available</div></td>
        <td style={{ width: 100 }}><input type="number" min="1" value={l.qty} onChange={e => setMake({ ...make, lines: make.lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x) })} /></td>
        <td>{l.item.pack_size > 1 ? <select value={l.mode} onChange={e => setMake({ ...make, lines: make.lines.map((x, j) => j === i ? { ...x, mode: e.target.value } : x) })}><option value="pack">{l.item.pack_name}s</option><option value="unit">{l.item.unit}s</option></select> : l.item.unit}</td>
        <td><button className="ghost sm" onClick={() => setMake({ ...make, lines: make.lines.filter((_, j) => j !== i) })}>✕</button></td></tr>)}</tbody></table>
    </Modal>}
  </div>;
}

// ================= barcode labels =================
export function Labels() {
  const c = useContext(ConfigContext);
  const [items, reload] = useData('/items');
  const [sel, setSel] = useState([]);
  const [size, setSize] = useState('50mm 30mm');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => (items || []).filter(i => (!onlyMissing || !i.barcode) && i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 80), [items, q, onlyMissing]);
  const generate = async () => {
    const need = sel.filter(s => !items.find(i => i.id === s.id)?.barcode);
    for (const s of need) await api.post(`/items/${s.id}/barcode`, { generate: true });
    if (need.length) { toast(`${need.length} item${need.length > 1 ? 's' : ''} given a shop barcode`); reload(); }
    return need.length;
  };
  const print = async () => {
    await generate();
    const fresh = await api.get('/items');
    const html = sel.flatMap(s => { const it = fresh.find(i => i.id === s.id); const price = s.mode === 'pack' || it.pack_size === 1 ? it.pack_price : it.price; const per = s.mode === 'pack' || it.pack_size === 1 ? (it.pack_size > 1 ? it.pack_name : it.unit) : it.unit;
      return Array.from({ length: Math.max(1, Number(s.copies) || 1) }, () => `<div class="lbl"><b>${it.name}</b><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="p">KES ${Number(price).toLocaleString()}</span><small>/${per}</small></div>${barcodeSvg(it.barcode)}<small>${c.facility_name}</small></div>`); }).join('');
    printLabelSheet(html, size);
  };
  return <div className="stack">
    <Tip id="labels">Most medicine boxes already carry a barcode: scan it into the item once (open the item, “Link barcode”). For items without one, such as loose tablets, repacked items or your own products, MediCore creates a shop barcode and prints price labels on the label printer.</Tip>
    <div className="grid g-side">
      <div className="stack">
        <div className="row"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search item" style={{ maxWidth: 300 }} /><label className="check"><input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />Only items without a barcode</label></div>
        <div className="tablewrap"><table className="table"><thead><tr><th>Item</th><th>Barcode</th><th /></tr></thead><tbody>{list.map(i => <tr key={i.id}>
          <td><div className="row" style={{ flexWrap: 'nowrap' }}><ProductArt item={i} size={32} rounded={6} /><b className="small">{i.name}</b></div></td>
          <td className="small">{i.barcode ? <span className="mono">{i.barcode}</span> : <span className="faint">none</span>}</td>
          <td><button className="sm" disabled={sel.some(s => s.id === i.id)} onClick={() => setSel([...sel, { id: i.id, name: i.name, copies: 1, mode: i.pack_size > 1 && i.sell_loose ? 'unit' : 'pack', item: i }])}>Add</button></td></tr>)}</tbody></table></div>
      </div>
      <div className="card stack" style={{ alignSelf: 'start', position: 'sticky', top: 16 }}>
        <b>Labels to print</b>
        <Field label="Label size"><select value={size} onChange={e => setSize(e.target.value)}><option value="50mm 30mm">50 × 30 mm</option><option value="38mm 25mm">38 × 25 mm (shelf)</option><option value="57mm 32mm">57 × 32 mm</option></select></Field>
        {sel.map((s, i) => <div key={s.id} className="row small" style={{ flexWrap: 'nowrap' }}><span style={{ flex: 1 }}>{s.name}</span>
          {s.item.pack_size > 1 && s.item.sell_loose ? <select value={s.mode} style={{ width: 'auto' }} onChange={e => setSel(sel.map((x, j) => j === i ? { ...x, mode: e.target.value } : x))}><option value="unit">per {s.item.unit}</option><option value="pack">per {s.item.pack_name}</option></select> : null}
          <input type="number" min="1" value={s.copies} style={{ width: 60 }} onChange={e => setSel(sel.map((x, j) => j === i ? { ...x, copies: e.target.value } : x))} /><button className="ghost sm" onClick={() => setSel(sel.filter((_, j) => j !== i))}>✕</button></div>)}
        {!sel.length && <span className="faint small">Add items from the list.</span>}
        {sel[0] && <div className="label-preview"><b>{sel[0].item.name}</b><div className="row"><b>{money(sel[0].mode === 'pack' || sel[0].item.pack_size === 1 ? sel[0].item.pack_price : sel[0].item.price)}</b></div>{sel[0].item.barcode ? <Barcode value={sel[0].item.barcode} height={34} /> : <span className="faint small">Barcode will be created</span>}<small>{c.facility_name}</small></div>}
        <button className="primary" disabled={!sel.length} onClick={print}><Icon name="print" size={15} />Print {sel.reduce((a, s) => a + (Number(s.copies) || 1), 0)} label{sel.length === 1 && Number(sel[0].copies) === 1 ? '' : 's'}</button>
      </div>
    </div>
  </div>;
}

// ---------------- Stock take: count what is on the shelf, then post the differences ----------------
export function StockTake() {
  const c = useContext(ConfigContext);
  const admin = c.user.role === 'admin' || c.user.role === 'superadmin';
  const [list, reload] = useData('/stock-counts');
  const [items] = useData('/items');
  const [open, setOpen] = useState(null);
  const [scope, setScope] = useState({ category: '', location: '' });
  const cats = useMemo(() => [...new Set((items || []).map(i => i.shop_cat).filter(Boolean))].sort(), [items]);
  const locs = useMemo(() => [...new Set((items || []).map(i => i.location).filter(Boolean))].sort(), [items]);
  const current = (list || []).find(x => x.status === 'open');
  const start = async () => { const r = await act(() => api.post('/stock-counts', scope), 'Count sheet ready'); reload(); setOpen(r.id); };
  if (open) return <CountSheet id={open} admin={admin} onBack={() => { setOpen(null); reload(); }} />;
  return <div className="stack">
    {current ? <div className="alert info row"><span><b>{current.count_no}</b> ({current.scope}) is in progress: {current.counted} of {current.total} lines counted.</span><button className="primary right" onClick={() => setOpen(current.id)}>Continue counting</button></div>
      : <div className="card stack">
        <h3 style={{ margin: 0 }}>Start a stock count</h3>
        <p className="muted small" style={{ margin: 0 }}>Count one shelf or category at a time while the shop is quiet. The system shows what it expects; you enter what you find. Differences are only applied when an administrator posts the count.</p>
        <div className="row">
          <Field label="Category"><select value={scope.category} onChange={e => setScope({ ...scope, category: e.target.value })}><option value="">All categories</option>{cats.map(x => <option key={x}>{x}</option>)}</select></Field>
          {locs.length > 0 && <Field label="Shelf / location"><select value={scope.location} onChange={e => setScope({ ...scope, location: e.target.value })}><option value="">All locations</option>{locs.map(x => <option key={x}>{x}</option>)}</select></Field>}
          <button className="primary" style={{ alignSelf: 'end' }} onClick={start}>Create count sheet</button>
        </div>
      </div>}
    <div className="card">
      <h3>Past counts</h3>
      {(list || []).length ? <table className="table"><thead><tr><th>Count</th><th>Scope</th><th>Started</th><th>Status</th><th className="num">Lines counted</th><th className="num">Value difference</th></tr></thead>
        <tbody>{list.map(x => <tr key={x.id} className="click" onClick={() => setOpen(x.id)}><td><b>{x.count_no}</b></td><td>{x.scope}</td><td>{fmtDT(x.created_at)} · {x.created_by}</td><td><Badge tone={x.status === 'posted' ? 'good' : x.status === 'open' ? 'warn' : ''}>{x.status === 'posted' ? 'Posted' : x.status === 'open' ? 'Counting' : 'Cancelled'}</Badge></td><td className="num">{x.counted} / {x.total}</td><td className="num" style={{ color: x.value_diff < 0 ? 'var(--bad)' : x.value_diff > 0 ? 'var(--good)' : null }}>{money(x.value_diff)}</td></tr>)}</tbody></table>
        : <Empty icon="box">No stock counts yet. Counting one category a week keeps stock accurate without closing the shop.</Empty>}
    </div>
  </div>;
}

function CountSheet({ id, admin, onBack }) {
  const [sc, setSc] = useState(null);
  const [vals, setVals] = useState({});
  const [q, setQ] = useState('');
  const [only, setOnly] = useState('all');
  React.useEffect(() => { api.get('/stock-counts/' + id).then(d => { setSc(d); setVals(Object.fromEntries(d.lines.map(l => [l.id, l.counted ?? '']))); }); }, [id]);
  if (!sc) return <div className="card">Loading…</div>;
  const open = sc.status === 'open';
  const dirty = sc.lines.filter(l => String(vals[l.id] ?? '') !== String(l.counted ?? ''));
  const save = async () => { if (!dirty.length) return; const d = await act(() => api.post(`/stock-counts/${id}/lines`, { lines: dirty.map(l => ({ id: l.id, counted: vals[l.id] })) }), `Saved ${dirty.length} count${dirty.length > 1 ? 's' : ''}`); setSc(d); };
  const post = async () => {
    if (dirty.length) await save();
    if (!confirm(`Post ${sc.count_no}? Stock will be changed to the counted quantities for every counted line. This cannot be undone.`)) return;
    const d = await act(() => api.post(`/stock-counts/${id}/post`), 'Stock count posted. Stock levels updated.'); setSc(d);
  };
  const cancel = async () => { if (!confirm('Cancel this count? Nothing will change in stock.')) return; await act(() => api.post(`/stock-counts/${id}/cancel`), 'Count cancelled'); onBack(); };
  const unit = l => l.pack_size > 1 ? l.unit : l.unit;
  const rows = sc.lines.filter(l => (!q || (l.name + ' ' + (l.code || '') + ' ' + (l.batch_no || '')).toLowerCase().includes(q.toLowerCase())) &&
    (only === 'all' || (only === 'todo' ? vals[l.id] === '' || vals[l.id] == null : vals[l.id] !== '' && Number(vals[l.id]) !== l.expected)));
  const printSheet = () => {
    const w = window.open('', '_blank');
    w.document.write(`<title>${sc.count_no} count sheet</title><style>body{font:13px Arial;margin:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:6px;text-align:left}th{background:#eee}.c{width:110px}</style><h2>Stock count ${sc.count_no} · ${sc.scope}</h2><p>Counted by: ____________________ Date: ____________</p><table><tr><th>Item</th><th>Batch</th><th>Expiry</th><th>Location</th><th class=c>Counted</th></tr>${sc.lines.map(l => `<tr><td>${l.name}</td><td>${l.batch_no || ''}</td><td>${l.expiry || ''}</td><td>${l.location || ''}</td><td></td></tr>`).join('')}</table>`);
    w.document.close(); w.print();
  };
  return <div className="stack">
    <div className="row"><button onClick={onBack}>← All counts</button><h3 style={{ margin: 0 }}>{sc.count_no} · {sc.scope}</h3>
      <Badge tone={sc.status === 'posted' ? 'good' : sc.status === 'open' ? 'warn' : ''}>{sc.status === 'posted' ? `Posted ${fmtDT(sc.posted_at)}` : sc.status === 'open' ? 'Counting' : 'Cancelled'}</Badge>
      <button className="right" onClick={printSheet}>Print count sheet</button></div>
    <div className="grid g4">
      <div className="card stat"><span className="label">Lines counted</span><b className="value">{sc.counted} / {sc.total}</b></div>
      <div className="card stat"><span className="label">Short</span><b className="value" style={{ color: 'var(--bad)' }}>{sc.short_lines}</b></div>
      <div className="card stat"><span className="label">Over</span><b className="value">{sc.over_lines}</b></div>
      <div className="card stat"><span className="label">Value difference (at cost)</span><b className="value" style={{ color: sc.value_diff < 0 ? 'var(--bad)' : null }}>{money(sc.value_diff)}</b></div>
    </div>
    <div className="row">
      <input placeholder="Find item or batch" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 280 }} />
      <div className="seg">{[['all', 'All'], ['todo', 'Not counted'], ['diff', 'Differences']].map(([k, l]) => <button key={k} className={only === k ? 'on' : ''} onClick={() => setOnly(k)}>{l}</button>)}</div>
      {open && <><button className="right" disabled={!dirty.length} onClick={save}>Save counts{dirty.length ? ` (${dirty.length})` : ''}</button>
        {admin ? <button className="primary" onClick={post}>Post count</button> : <span className="muted small">An administrator posts the count</span>}
        {admin && <button className="ghost" onClick={cancel}>Cancel count</button>}</>}
    </div>
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <table className="table"><thead><tr><th>Item</th><th>Batch · expiry</th><th>Location</th><th className="num">System</th><th className="num">Counted</th><th className="num">Difference</th></tr></thead>
        <tbody>{rows.map(l => { const v = vals[l.id]; const d = v === '' || v == null ? null : Number(v) - l.expected; return <tr key={l.id}>
          <td><b>{l.name}</b>{l.code ? <span className="faint small"> · {l.code}</span> : null}</td>
          <td className="small">{l.batch_no || <span className="faint">No stock on record</span>}{l.expiry ? ` · ${fmtDate(l.expiry)}` : ''}</td>
          <td className="small">{l.location || ''}</td>
          <td className="num">{l.expected_text}</td>
          <td className="num">{open ? <CountInput l={l} v={v} set={x => setVals({ ...vals, [l.id]: x })} /> : (l.counted_text || '—')}</td>
          <td className="num" style={{ color: d < 0 ? 'var(--bad)' : d > 0 ? 'var(--good)' : null, fontWeight: d ? 700 : 400 }}>{d == null ? '' : (d > 0 ? '+' : '−') + packText(l, Math.abs(d))}</td>
        </tr>; })}</tbody></table>
      {!rows.length && <Empty icon="search">No lines match.</Empty>}
    </div>
  </div>;
}

// Count in packs and loose pieces, the way stock sits on the shelf; stored as single units
function CountInput({ l, v, set }) {
  const ps = l.pack_size > 1 ? l.pack_size : 1;
  const has = v !== '' && v != null;
  const packs = has ? Math.floor(Number(v) / ps) : '';
  const loose = has ? Number(v) - packs * ps : '';
  const upd = (p, u) => { if (p === '' && u === '') return set(''); set(String((Number(p) || 0) * ps + (Number(u) || 0))); };
  const box = { width: 70, textAlign: 'right' };
  if (ps === 1) return <span className="row" style={{ justifyContent: 'flex-end', gap: 6, flexWrap: 'nowrap' }}><input type="number" min="0" inputMode="numeric" value={v ?? ''} onChange={e => set(e.target.value)} style={box} /><span className="small muted">{plu(l.unit)}</span></span>;
  return <span className="row" style={{ justifyContent: 'flex-end', gap: 6, flexWrap: 'nowrap' }}>
    <input type="number" min="0" inputMode="numeric" aria-label={l.pack_name + 's'} value={packs} onChange={e => upd(e.target.value, loose)} style={box} /><span className="small muted">{plu(l.pack_name)}</span>
    <input type="number" min="0" inputMode="numeric" aria-label={l.unit + 's'} value={loose} onChange={e => upd(packs, e.target.value)} style={{ ...box, width: 60 }} /><span className="small muted">{plu(l.unit)}</span>
  </span>;
}

const packText = (l, q) => { const ps = l.pack_size > 1 ? l.pack_size : 1; const p = Math.floor(q / ps), u = q - p * ps; return ps === 1 ? `${q} ${q === 1 ? l.unit : plu(l.unit)}` : [p && `${p} ${p === 1 ? l.pack_name : plu(l.pack_name)}`, u && `${u} ${u === 1 ? l.unit : plu(l.unit)}`].filter(Boolean).join(' + ') || '0'; };

const plu = w => /(x|s|ch|sh)$/.test(w || '') ? w + 'es' : (w || '') + 's';

// ---------------- Expired, damaged and recalled stock: write-off and the disposal register ----------------
export function Disposal() {
  const c = useContext(ConfigContext);
  const can = ['admin', 'superadmin', 'pharmacist'].includes(c.user.role);
  const [cands, reloadC] = useData('/disposals/candidates');
  const [reg, reloadR] = useData('/disposals');
  const [pick, setPick] = useState({});
  const [f, setF] = useState(null);
  const chosen = (cands || []).filter(b => pick[b.id] > 0);
  const value = chosen.reduce((a, b) => a + pick[b.id] * (b.cost || 0), 0);
  const submit = async () => {
    const r = await act(() => api.post('/disposals', { ...f, lines: chosen.map(b => ({ batch_id: b.id, qty: pick[b.id] })) }), 'Stock written off');
    toast(`${r.disp_no}: ${r.lines} batch${r.lines > 1 ? 'es' : ''} written off, ${money(r.value)} at cost`);
    setF(null); setPick({}); reloadC(); reloadR();
  };
  const printReg = () => {
    const w = window.open('', '_blank');
    w.document.write(`<title>Disposal register</title><style>body{font:12px Arial;margin:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:5px;text-align:left}th{background:#eee}</style><h2>${c.facility_name} · Disposal register</h2><table><tr><th>No.</th><th>Date</th><th>Item</th><th>Batch</th><th>Expiry</th><th>Quantity</th><th>Value (cost)</th><th>Reason</th><th>Method</th><th>Witness</th><th>Recorded by</th></tr>${(reg?.rows || []).map(d => `<tr><td>${d.disp_no}</td><td>${new Date(d.created_at).toLocaleDateString('en-KE')}</td><td>${d.name}${d.controlled ? ' (controlled)' : ''}</td><td>${d.batch_no || ''}</td><td>${d.expiry || ''}</td><td>${d.qty_text}</td><td>${d.value.toLocaleString('en-KE')}</td><td>${d.reason}</td><td>${d.method}</td><td>${d.witness}</td><td>${d.by_user}</td></tr>`).join('')}</table><p style="margin-top:30px">Superintendent pharmacist: ______________________ Signature: ____________ Date: __________</p>`);
    w.document.close(); w.print();
  };
  return <div className="stack">
    <Tip id="disposal">Expired, damaged or recalled stock must come off the shelf and out of the stock count, with a witness. Enter how much of each batch is going (or tap All), then record how it will be disposed of and who witnessed it. The register prints for PPB inspection.</Tip>
    <div className="card" style={{ padding: 0 }}>
      <div className="row" style={{ padding: '14px 16px 0' }}><h3 style={{ margin: 0 }}>Expired or expiring within 60 days</h3>
        {chosen.length > 0 && can && <button className="primary right" onClick={() => setF({ reason: 'Expired', method: '', witness: '', note: '' })}>Write off {chosen.length} batch{chosen.length > 1 ? 'es' : ''} · {money(value)}</button>}</div>
      {(cands || []).length ? <div className="tablewrap"><table className="table"><thead><tr><th>Item</th><th>Batch</th><th>Expiry</th><th className="num">In stock</th><th className="num">Value at cost</th><th className="num">Write off (single units)</th></tr></thead>
        <tbody>{cands.map(b => <tr key={b.id}><td><b>{b.name}</b>{b.controlled ? <> <Badge tone="warn">Controlled</Badge></> : null}</td><td className="small">{b.batch_no}</td>
          <td>{b.expired ? <Badge tone="bad">Expired {fmtDate(b.expiry)}</Badge> : <Badge tone="warn">{fmtDate(b.expiry)}</Badge>}</td><td className="num">{b.qty_text}</td><td className="num">{money(b.value)}</td>
          <td className="num">{can ? <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap', gap: 6 }}><input type="number" min="0" max={b.qty} value={pick[b.id] ?? ''} onChange={e => setPick({ ...pick, [b.id]: Math.min(b.qty, Math.max(0, Number(e.target.value))) })} style={{ width: 90, textAlign: 'right' }} /><button className="sm" onClick={() => setPick({ ...pick, [b.id]: b.qty })}>All</button></span> : '-'}</td></tr>)}</tbody></table></div>
        : <Empty icon="check">Nothing expired or expiring in the next 60 days.</Empty>}
    </div>
    <div className="card">
      <div className="row"><h3 style={{ margin: 0 }}>Disposal register</h3><button className="right" onClick={printReg} disabled={!reg?.rows?.length}><Icon name="print" size={15} />Print register</button></div>
      {reg?.rows?.length ? <div className="tablewrap"><table className="table small"><thead><tr><th>No.</th><th>Date</th><th>Item</th><th>Batch · expiry</th><th className="num">Quantity</th><th className="num">Value</th><th>Reason</th><th>Method</th><th>Witness</th><th>By</th></tr></thead>
        <tbody>{reg.rows.map(d => <tr key={d.id}><td><b>{d.disp_no}</b></td><td>{fmtDT(d.created_at)}</td><td>{d.name}</td><td>{d.batch_no} · {fmtDate(d.expiry)}</td><td className="num">{d.qty_text}</td><td className="num">{money(d.value)}</td><td>{d.reason}</td><td>{d.method}</td><td>{d.witness}</td><td>{d.by_user}</td></tr>)}</tbody></table></div>
        : <Empty icon="box">Nothing written off yet.</Empty>}
    </div>
    {f && <Modal title="Write off stock" onClose={() => setF(null)} footer={<><button onClick={() => setF(null)}>Cancel</button><button className="danger solid" onClick={submit}>Write off {money(value)}</button></>}>
      <div className="fields">
        <Field label="Reason"><select value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })}>{(reg?.reasons || ['Expired']).map(r => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Disposal method" hint="e.g. returned to supplier for credit, collected by PPB-licensed disposer, incinerated"><input value={f.method} onChange={e => setF({ ...f, method: e.target.value })} /></Field>
        <Field label="Witness (name)"><input value={f.witness} onChange={e => setF({ ...f, witness: e.target.value })} /></Field>
        <Field label="Note"><input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Optional" /></Field>
      </div>
      <p className="small muted">{chosen.map(b => `${b.name} (${b.batch_no}): ${pick[b.id]}`).join(' · ')}</p>
    </Modal>}
  </div>;
}
