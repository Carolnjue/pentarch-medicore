// Pentarch cloud: online demos and the sales agent portal.
// Switched on with MEDICORE_CLOUD=1 on the Pentarch server. Facility installations do not run this.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PRICING = require('./pricing');
const LIC = require('./licence');

const G = require('./guard');
module.exports = function cloud(app, H) {
  const { D, R, wrap, fail, now, PHONE } = H;
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (n, from = Date.now()) => { const d = new Date(from); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const normPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 9 ? '0' + d.slice(-9) : d; };
  const keyFile = process.env.MEDICORE_LICENCE_KEY_FILE || path.join(__dirname, '..', 'data', 'pentarch-licence-private.pem');
  const canIssue = () => fs.existsSync(keyFile);

  // ---------- portal sign-in (separate from facility staff) ----------
  if (!R.get("SELECT id FROM agents WHERE role='admin'")) {
    R.run("INSERT INTO agents(name,phone,email,code,pin_hash,role,status,created_at,approved_at) VALUES(?,?,?,?,?,'admin','active',?,?)",
      'Pentarch Admin', process.env.PORTAL_ADMIN_PHONE || '0700000000', 'info@pentarchsystemssolutions.co.ke', 'PENTARCH', D.hashPin(process.env.MEDICORE_SUPER_PIN || '2026'), now(), now());
  }
  function agentOf(req) {
    const t = req.get('x-portal');
    const s = t && R.get('SELECT * FROM portal_sessions WHERE token=?', t);
    let a = s && R.get("SELECT * FROM agents WHERE id=? AND status='active'", s.agent_id);
    if (a && Date.now() - new Date(s.created_at) > (a.role === 'admin' ? 14 : 90) * 864e5) { R.run('DELETE FROM portal_sessions WHERE token=?', t); a = null; }
    if (!a) fail('Please sign in to the sales portal', 401);
    return a;
  }
  const isAdmin = a => a.role === 'admin' || a.role === 'manager';
  const pub = a => ({ id: a.id, name: a.name, phone: a.phone, email: a.email, county: a.county, code: a.code, role: a.role, status: a.status, mpesa: a.mpesa, created_at: a.created_at });
  const newCode = name => { let c; do c = (name || 'AG').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X') + crypto.randomInt(100, 999); while (R.get('SELECT id FROM agents WHERE code=?', c)); return c; };

  app.post('/api/public/portal/signup', wrap(req => {
    H.publicLimit(req, 'signup', 5);
    const b = req.body;
    if (!b.name?.trim() || !b.phone || !b.pin) fail('Name, phone and a PIN are required');
    if (!PHONE.test(String(b.phone).replace(/\s/g, ''))) fail('Enter a valid Kenyan phone number');
    if (!/^\d{4,8}$/.test(String(b.pin))) fail('Choose a PIN of 4 to 8 digits');
    const phone = normPhone(b.phone);
    if (R.get('SELECT id FROM agents WHERE phone=?', phone)) fail('That phone number is already registered. Sign in instead.');
    const ref = b.referral ? R.get('SELECT id FROM agents WHERE code=?', String(b.referral).toUpperCase()) : null;
    R.run("INSERT INTO agents(name,phone,email,county,mpesa,id_no,code,pin_hash,role,status,referred_by,created_at) VALUES(?,?,?,?,?,?,?,?,'agent','pending',?,?)",
      b.name.trim(), phone, b.email, b.county, normPhone(b.mpesa || b.phone), b.id_no, newCode(b.name), D.hashPin(String(b.pin)), ref?.id, now());
    return { ok: true, message: 'Thank you. Pentarch will review your application and call you within 2 working days. You can sign in once approved.' };
  }));
  app.post('/api/public/portal/login', wrap(req => {
    const a = R.get('SELECT * FROM agents WHERE phone=?', normPhone(req.body.phone));
    const keys = ['p:' + String(req.body.phone || '').replace(/\D/g, ''), 'ip:' + req.ip];
    G.check(keys);
    if (!a || !D.verifyPin(a.pin_hash, req.body.pin)) { G.failed(keys); fail('Wrong phone number or PIN', 401); }
    G.passed(keys);
    if (G.isLegacy(a.pin_hash)) R.run('UPDATE agents SET pin_hash=? WHERE id=?', D.hashPin(String(req.body.pin)), a.id);
    if (a.status === 'pending') fail('Your application is still being reviewed. Pentarch will call you.', 403);
    if (a.status !== 'active') fail('This account is not active. Contact Pentarch.', 403);
    const token = crypto.randomBytes(24).toString('hex');
    R.run('INSERT INTO portal_sessions(token,agent_id,created_at) VALUES(?,?,?)', token, a.id, now());
    return { token, agent: pub(a) };
  }));
  app.get('/api/public/portal/me', wrap(req => ({ agent: pub(agentOf(req)), pricing: PRICING, canIssue: canIssue() })));

  // ---------- leads: offline-friendly sync (client sends anything it created or changed while offline) ----------
  const LEAD_FIELDS = ['facility', 'type', 'contact', 'role', 'phone', 'email', 'county', 'town', 'lat', 'lng', 'stage', 'package', 'plan', 'billing', 'value', 'next_action', 'next_date', 'notes', 'lost_reason'];
  const STAGES = ['lead', 'contacted', 'demo', 'trial', 'negotiating', 'won', 'lost'];
  function leadView(l) {
    const acts = R.all('SELECT * FROM activities WHERE lead_id=? ORDER BY at DESC', l.id);
    const agent = R.get('SELECT name, code FROM agents WHERE id=?', l.agent_id);
    let demo = null;
    if (l.demo_org_id) { const st = H.licenceState(l.demo_org_id); demo = { org_id: l.demo_org_id, user: l.demo_user, pin: l.demo_pin, ends: l.demo_ends, status: st.status, days_left: st.days_left, activity: demoActivity(l.demo_org_id) }; }
    return { ...l, demo_pin: undefined, agent_name: agent?.name, agent_code: agent?.code, activities: acts, demo };
  }
  function demoActivity(orgId) {
    const b = R.get('SELECT id FROM branches WHERE org_id=? ORDER BY id LIMIT 1', orgId);
    if (!b) return null;
    try { D.use(b.id); const r = D.get("SELECT MAX(created_at) last, COUNT(*) n FROM audit"); const s = D.get("SELECT COUNT(*) n FROM bills WHERE created_at>=?", addDays(-30)); return { last: r.last, actions: r.n, bills: s.n }; } catch { return null; }
  }
  app.get('/api/public/portal/leads', wrap(req => {
    const a = agentOf(req);
    const rows = isAdmin(a) && req.query.all ? R.all('SELECT * FROM leads ORDER BY updated_at DESC LIMIT 1000') : R.all('SELECT * FROM leads WHERE agent_id=? ORDER BY updated_at DESC', a.id);
    return rows.map(leadView);
  }));
  app.post('/api/public/portal/sync', wrap(req => {
    const a = agentOf(req);
    const { leads = [], activities = [] } = req.body;
    const saved = [];
    for (const l of leads) {
      if (!l.uid || !l.facility?.trim()) continue;
      if (l.stage && !STAGES.includes(l.stage)) l.stage = 'lead';
      const ex = R.get('SELECT * FROM leads WHERE uid=?', l.uid);
      if (ex && ex.agent_id !== a.id && !isAdmin(a)) continue;
      if (!ex) {
        const dup = l.phone && R.get("SELECT l.*, a.name agent FROM leads l LEFT JOIN agents a ON a.id=l.agent_id WHERE l.phone=? AND l.stage NOT IN ('lost') AND l.agent_id!=?", normPhone(l.phone), a.id);
        const id = R.run(`INSERT INTO leads(uid,agent_id,source,${LEAD_FIELDS.join(',')},created_at,updated_at) VALUES(?,?,?,${LEAD_FIELDS.map(() => '?').join(',')},?,?)`,
          l.uid, a.id, l.source || 'agent', ...LEAD_FIELDS.map(k => k === 'phone' ? normPhone(l[k]) : k === 'stage' ? (l[k] || 'lead') : l[k]), l.created_at || now(), now()).lastInsertRowid;
        if (dup) R.run("INSERT INTO activities(uid,lead_id,agent_id,kind,note,at) VALUES(?,?,?,?,?,?)", crypto.randomUUID(), id, a.id, 'note', `Possible duplicate: this phone is also with ${dup.agent} (${dup.facility}). Pentarch will confirm who registered first.`, now());
        saved.push(l.uid);
      } else {
        R.run(`UPDATE leads SET ${LEAD_FIELDS.map(k => k + '=?').join(',')}, updated_at=?, won_at=COALESCE(won_at, ?) WHERE id=?`,
          ...LEAD_FIELDS.map(k => l[k] !== undefined ? (k === 'phone' ? normPhone(l[k]) : l[k]) : ex[k]), now(), l.stage === 'won' ? now() : null, ex.id);
        saved.push(l.uid);
      }
    }
    for (const x of activities) {
      if (!x.uid || R.get('SELECT id FROM activities WHERE uid=?', x.uid)) continue;
      const lead = R.get('SELECT * FROM leads WHERE uid=?', x.lead_uid);
      if (!lead || (lead.agent_id !== a.id && !isAdmin(a))) continue;
      R.run('INSERT INTO activities(uid,lead_id,lead_uid,agent_id,kind,note,at) VALUES(?,?,?,?,?,?,?)', x.uid, lead.id, x.lead_uid, a.id, x.kind || 'note', x.note, x.at || now());
      R.run('UPDATE leads SET updated_at=? WHERE id=?', now(), lead.id);
    }
    return { saved, server_time: now() };
  }));

  // ---------- online demo for a client (sample data, 30 days) ----------
  function createDemo({ facility, type, contact, phone, email, location }, agent, leadId) {
    if (!H.TYPES[type]) type = 'pharmacy';
    const base = (facility || 'demo').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10) || 'demo';
    let username; do username = base + crypto.randomInt(10, 99); while (R.get('SELECT id FROM users WHERE username=?', username));
    const pin = String(crypto.randomInt(1000, 9999));
    const staffPin = String(crypto.randomInt(1000, 9999)); // the sample team gets its own PIN per demo, never a shared one
    const orgId = R.run('INSERT INTO orgs(name,owner_name,phone,email,location,created_at,demo,lead_id,agent_id) VALUES(?,?,?,?,?,?,1,?,?)',
      facility, contact || facility, phone, email, location, now(), leadId, agent?.id).lastInsertRowid;
    H.createBranch(orgId, { name: facility, type, phone, email, location }, true);
    R.run("INSERT INTO users(org_id,branch_id,name,username,pin_hash,role,created_at) VALUES(?,NULL,?,?,?,'admin',?)", orgId, contact || 'Owner', username, D.hashPin(pin), now());
    for (const [n, r, role] of H.SAMPLE_STAFF) if (!(type === 'pharmacy' && r === 'nurse')) R.run('INSERT INTO users(org_id,branch_id,name,username,pin_hash,role,created_at) VALUES(?,NULL,?,?,?,?,?)', orgId, n, H.uniqueUsername(`${base}.${r}`), D.hashPin(staffPin), role, now());
    H.startTrial(orgId);
    const ends = R.get('SELECT trial_ends FROM licences WHERE org_id=?', orgId).trial_ends;
    return { org_id: orgId, username, pin, ends, staff_pin: staffPin };
  }
  app.post('/api/public/portal/leads/:uid/demo', wrap(req => {
    const a = agentOf(req);
    const l = R.get('SELECT * FROM leads WHERE uid=?', req.params.uid);
    if (!l || (l.agent_id !== a.id && !isAdmin(a))) fail('Client not found', 404);
    if (l.demo_org_id && R.get('SELECT id FROM orgs WHERE id=?', l.demo_org_id)) fail('This client already has a demo. Share the same sign-in.');
    const d = createDemo({ facility: l.facility, type: l.type, contact: l.contact, phone: l.phone, email: l.email, location: [l.town, l.county].filter(Boolean).join(', ') }, a, l.id);
    R.run("UPDATE leads SET demo_org_id=?, demo_user=?, demo_pin=?, demo_ends=?, stage=CASE WHEN stage IN ('lead','contacted','demo') THEN 'trial' ELSE stage END, updated_at=? WHERE id=?", d.org_id, d.username, d.pin, d.ends, now(), l.id);
    R.run('INSERT INTO activities(uid,lead_id,lead_uid,agent_id,kind,note,at) VALUES(?,?,?,?,?,?,?)', crypto.randomUUID(), l.id, l.uid, a.id, 'demo', `30-day online demo created (sign in ${d.username})`, now());
    return { ...d, url: (process.env.PUBLIC_URL || '') + '/' };
  }));
  // Website "Try the demo" form: makes a lead (for the referring agent if a code was given) and a demo
  const recent = {};
  app.post('/api/public/demo', wrap(req => {
    const b = req.body;
    if (!b.facility?.trim() || !b.contact?.trim() || !b.phone) fail('Facility name, your name and phone are required');
    if (!PHONE.test(String(b.phone).replace(/\s/g, ''))) fail('Enter a valid Kenyan phone number, e.g. 0712 345 678');
    const ip = req.ip || 'x';
    recent[ip] = (recent[ip] || []).filter(t => Date.now() - t < 864e5);
    const phone = normPhone(b.phone);
    const ex = R.get('SELECT * FROM leads WHERE phone=? AND demo_org_id IS NOT NULL ORDER BY id DESC LIMIT 1', phone);
    if (ex && R.get('SELECT id FROM orgs WHERE id=?', ex.demo_org_id) && ex.demo_ends >= today()) fail(`A demo for this number is already running until ${ex.demo_ends}. Sign in with username ${ex.demo_user}; your PIN was shown when it was created. Forgot it? Call Pentarch.`);
    const agent = b.agent ? R.get("SELECT * FROM agents WHERE code=? AND status='active'", String(b.agent).toUpperCase()) : null;
    // a sales agent signing up clients in one office or training room gets a higher daily allowance
    if (recent[ip].length >= (agent ? 40 : 5)) fail('Too many demos from this connection today. Call us and we will set one up.');
    const uid = crypto.randomUUID();
    const leadId = R.run(`INSERT INTO leads(uid,agent_id,source,facility,type,contact,phone,email,county,town,stage,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'trial',?,?)`,
      uid, agent?.id || null, 'website', b.facility.trim(), b.type, b.contact.trim(), phone, b.email, b.county, b.town, now(), now()).lastInsertRowid;
    const d = createDemo({ facility: b.facility.trim(), type: b.type, contact: b.contact.trim(), phone, email: b.email, location: [b.town, b.county].filter(Boolean).join(', ') }, agent, leadId);
    R.run('UPDATE leads SET demo_org_id=?, demo_user=?, demo_pin=?, demo_ends=? WHERE id=?', d.org_id, d.username, d.pin, d.ends, leadId);
    recent[ip].push(Date.now());
    const u = R.get('SELECT * FROM users WHERE username=?', d.username);
    return { ...d, session: H.sessionFor(u) };
  }));

  // ---------- winning a client: commission and licence key ----------
  app.post('/api/public/portal/leads/:uid/won', wrap(req => {
    const a = agentOf(req);
    const l = R.get('SELECT * FROM leads WHERE uid=?', req.params.uid);
    if (!l || (l.agent_id !== a.id && !isAdmin(a))) fail('Client not found', 404);
    const { plan, billing = 'yearly', kit = false, amount_paid } = req.body;
    const p = PRICING.plans[plan];
    if (!p) fail('Choose the plan the client bought');
    const yearValue = billing === 'monthly' ? p.monthly * 12 : p.yearly;
    R.run("UPDATE leads SET stage='won', plan=?, billing=?, package=?, value=?, won_at=COALESCE(won_at, ?), updated_at=? WHERE id=?", plan, billing, kit ? 'kit' : 'software', yearValue + (kit ? PRICING.kit.price : 0), now(), now(), l.id);
    if (l.agent_id && !R.get('SELECT id FROM commissions WHERE lead_id=?', l.id)) {
      R.run("INSERT INTO commissions(lead_id,agent_id,description,base,rate,amount,status,created_at) VALUES(?,?,?,?,?,?,'due',?)", l.id, l.agent_id,
        `${p.label} plan (${billing}), first year`, yearValue, PRICING.commission.softwareRate, Math.round(yearValue * PRICING.commission.softwareRate), now());
      if (kit) R.run("INSERT INTO commissions(lead_id,agent_id,description,base,rate,amount,status,created_at) VALUES(?,?,?,?,?,?,'due',?)", l.id, l.agent_id, 'Counter Kit installed', PRICING.kit.price, 0, PRICING.commission.kitBonus, now());
    }
    R.run('INSERT INTO activities(uid,lead_id,lead_uid,agent_id,kind,note,at) VALUES(?,?,?,?,?,?,?)', crypto.randomUUID(), l.id, l.uid, a.id, 'won', `Won: ${p.label} ${billing}${kit ? ' + Counter Kit' : ''}${amount_paid ? `, paid KES ${amount_paid}` : ''}`, now());
    return leadView(R.get('SELECT * FROM leads WHERE id=?', l.id));
  }));
  app.post('/api/public/portal/leads/:uid/licence', wrap(req => {
    const a = agentOf(req);
    if (!isAdmin(a)) fail('Only Pentarch can issue licence keys', 403);
    if (!canIssue()) fail('The licence signing key is not installed on this server');
    const l = R.get('SELECT * FROM leads WHERE uid=?', req.params.uid);
    if (!l) fail('Client not found', 404);
    const months = Math.max(1, Math.min(36, Number(req.body.months) || 12));
    const plan = req.body.plan || l.plan || 'pharmacy';
    const until = addDays(Math.round(months * 30.44));
    const id = 'L' + Date.now().toString(36).toUpperCase();
    const key = LIC.sign({ id, org: req.body.org_name || l.facility, phone: l.phone, plan, branches: Number(req.body.branches) || 1, until }, fs.readFileSync(keyFile));
    R.run('INSERT INTO issued_keys(lead_id,org_name,phone,plan,until,key,issued_by,created_at) VALUES(?,?,?,?,?,?,?,?)', l.id, req.body.org_name || l.facility, l.phone, plan, until, key, a.name, now());
    R.run('INSERT INTO activities(uid,lead_id,lead_uid,agent_id,kind,note,at) VALUES(?,?,?,?,?,?,?)', crypto.randomUUID(), l.id, l.uid, a.id, 'licence', `Licence ${id} issued, ${plan}, valid to ${until}`, now());
    // a running online demo becomes the client's live system at once
    if (l.demo_org_id && R.get('SELECT id FROM orgs WHERE id=?', l.demo_org_id)) {
      R.run("UPDATE licences SET key=?, plan=?, paid_until=?, status='active', updated_at=? WHERE org_id=?", key, plan, until, now(), l.demo_org_id);
      R.run('UPDATE orgs SET demo=0 WHERE id=?', l.demo_org_id);
    }
    return { key, until, id };
  }));

  // ---------- money and performance ----------
  app.get('/api/public/portal/earnings', wrap(req => {
    const a = agentOf(req);
    const rows = R.all(`SELECT c.*, l.facility, ag.name agent FROM commissions c LEFT JOIN leads l ON l.id=c.lead_id LEFT JOIN agents ag ON ag.id=c.agent_id WHERE ${isAdmin(a) && req.query.all ? '1=1' : 'c.agent_id=?'} ORDER BY c.id DESC`, ...(isAdmin(a) && req.query.all ? [] : [a.id]));
    return { rows, due: rows.filter(r => r.status === 'due').reduce((s, r) => s + r.amount, 0), paid: rows.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0) };
  }));
  app.post('/api/public/portal/commissions/:id/paid', wrap(req => {
    const a = agentOf(req);
    if (!isAdmin(a)) fail('Pentarch only', 403);
    R.run("UPDATE commissions SET status='paid', paid_at=?, ref=? WHERE id=?", now(), req.body.ref, req.params.id);
    return { ok: true };
  }));
  app.get('/api/public/portal/stats', wrap(req => {
    const a = agentOf(req);
    const scope = isAdmin(a) && req.query.all ? '' : ' AND agent_id=' + a.id;
    const month = today().slice(0, 7);
    const byStage = R.all(`SELECT stage, COUNT(*) n, COALESCE(SUM(value),0) v FROM leads WHERE 1=1 ${scope} GROUP BY stage`);
    const board = R.all(`SELECT ag.id, ag.name, ag.code, COUNT(l.id) leads, SUM(CASE WHEN l.stage='won' THEN 1 ELSE 0 END) won,
      SUM(CASE WHEN l.stage='won' AND substr(l.won_at,1,7)=? THEN 1 ELSE 0 END) won_month, SUM(CASE WHEN l.demo_org_id IS NOT NULL THEN 1 ELSE 0 END) demos
      FROM agents ag LEFT JOIN leads l ON l.agent_id=ag.id WHERE ag.status='active' AND ag.role='agent' GROUP BY ag.id ORDER BY won_month DESC, won DESC, leads DESC LIMIT 20`, month);
    const followups = R.all(`SELECT uid, facility, contact, phone, next_action, next_date, stage FROM leads WHERE next_date IS NOT NULL AND next_date<=? AND stage NOT IN ('won','lost') ${scope} ORDER BY next_date LIMIT 30`, addDays(1));
    const expiring = R.all(`SELECT uid, facility, demo_ends FROM leads WHERE demo_ends BETWEEN ? AND ? AND stage NOT IN ('won','lost') ${scope} ORDER BY demo_ends`, today(), addDays(7));
    return { byStage, board, followups, expiring, month };
  }));
  // Pentarch admin: agents
  app.get('/api/public/portal/agents', wrap(req => {
    const a = agentOf(req); if (!isAdmin(a)) fail('Pentarch only', 403);
    return R.all('SELECT * FROM agents ORDER BY CASE status WHEN \'pending\' THEN 0 ELSE 1 END, id DESC').map(x => ({ ...pub(x), id_no: x.id_no,
      leads: R.get('SELECT COUNT(*) n FROM leads WHERE agent_id=?', x.id).n, won: R.get("SELECT COUNT(*) n FROM leads WHERE agent_id=? AND stage='won'", x.id).n,
      referred_by: x.referred_by ? R.get('SELECT name FROM agents WHERE id=?', x.referred_by)?.name : null }));
  }));
  app.post('/api/public/portal/agents/:id/status', wrap(req => {
    const a = agentOf(req); if (!isAdmin(a)) fail('Pentarch only', 403);
    const st = req.body.status;
    if (!['active', 'suspended', 'rejected'].includes(st)) fail('Unknown status');
    R.run('UPDATE agents SET status=?, approved_at=COALESCE(approved_at, ?), role=COALESCE(?, role) WHERE id=?', st, st === 'active' ? now() : null, req.body.role || null, req.params.id);
    return { ok: true };
  }));

  // ---------- housekeeping: remove online demos 15 days after they end ----------
  function sweep() {
    for (const o of R.all('SELECT o.id FROM orgs o JOIN licences l ON l.org_id=o.id WHERE o.demo=1 AND l.trial_ends<? AND l.key IS NULL', addDays(-15))) {
      for (const b of R.all('SELECT id FROM branches WHERE org_id=?', o.id)) { try { H.dropBranch(b.id); } catch {} }
      R.run('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE org_id=?)', o.id);
      R.run('DELETE FROM users WHERE org_id=?', o.id); R.run('DELETE FROM branches WHERE org_id=?', o.id); R.run('DELETE FROM licences WHERE org_id=?', o.id); R.run('DELETE FROM orgs WHERE id=?', o.id);
      R.run('UPDATE leads SET demo_org_id=NULL WHERE demo_org_id=?', o.id);
    }
  }
  sweep(); setInterval(sweep, 6 * 3600e3).unref();
};
