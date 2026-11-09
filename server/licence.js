// Pentarch MediCore licensing: 30-day trial, then a signed licence key.
// Keys are signed by Pentarch (Ed25519). Every installation can check them offline with the public key.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC = crypto.createPublicKey(fs.readFileSync(path.join(__dirname, 'licence-public.pem')));
const TRIAL_DAYS = Number(process.env.MEDICORE_TRIAL_DAYS || 30);
const GRACE_DAYS = 7;
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64u = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const day = d => new Date(d).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return day(x); };
const PLANS = {
  pharmacy: { label: 'Pharmacy', branches: 1 },
  clinic: { label: 'Clinic', branches: 1 },
  hospital: { label: 'Hospital', branches: 1 },
  group: { label: 'Group (several branches)', branches: 5 },
};

// Used only on the Pentarch server (needs the private key)
function sign(payload, privatePem) {
  const body = b64u(JSON.stringify({ v: 1, issued: day(Date.now()), ...payload }));
  const sig = crypto.sign(null, Buffer.from(body), crypto.createPrivateKey(privatePem));
  return 'MC1.' + body + '.' + b64u(sig);
}
function verify(key) {
  const m = String(key || '').trim().replace(/\s+/g, '').match(/^MC1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error('That does not look like a MediCore licence key');
  if (!crypto.verify(null, Buffer.from(m[1]), PUBLIC, unb64u(m[2]))) throw new Error('This licence key is not valid. Check it was copied completely.');
  return JSON.parse(unb64u(m[1]).toString());
}

module.exports = function licensing(app, H) {
  const { R, wrap, fail, now } = H;
  const today = () => day(Date.now());
  function rowFor(orgId) {
    let r = R.get('SELECT * FROM licences WHERE org_id=?', orgId);
    if (!r) {
      R.run("INSERT INTO licences(org_id,plan,status,trial_ends,updated_at) VALUES(?,?,'trial',?,?)", orgId, null, addDays(Date.now(), TRIAL_DAYS), now());
      r = R.get('SELECT * FROM licences WHERE org_id=?', orgId);
    }
    return r;
  }
  function state(orgId) {
    if (!orgId) return { status: 'active', super: true };
    const r = rowFor(orgId);
    const t = today();
    const diff = d => Math.round((new Date(d) - new Date(t)) / 864e5);
    let p = null;
    if (r.key) { try { p = verify(r.key); } catch { p = null; } }
    if (p && p.until >= t) return { status: 'active', plan: p.plan, plan_label: PLANS[p.plan]?.label || p.plan, until: p.until, days_left: diff(p.until), licensee: p.org, branches: p.branches, id: p.id };
    const end = p ? p.until : r.trial_ends;
    const left = diff(end);
    if (left >= 0 && !p) return { status: 'trial', trial_ends: end, days_left: left, trial_days: TRIAL_DAYS };
    if (left >= -GRACE_DAYS) return { status: 'grace', ends: end, was: p ? 'licence' : 'trial', days_left: GRACE_DAYS + left };
    return { status: 'expired', ends: end, was: p ? 'licence' : 'trial' };
  }
  H.licenceState = state;
  H.startTrial = orgId => rowFor(orgId);

  // After the trial or licence ends (plus 7 days' grace) the system stays readable but stops taking new work
  const ALWAYS = ['/api/licence', '/api/login', '/api/logout', '/api/me/pin', '/api/onboard', '/api/public'];
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || !req.user || req.user.role === 'superadmin') return next();
    const full = '/api' + req.path;
    if (ALWAYS.some(p => full.startsWith(p))) return next();
    const orgId = req.user.org_id || req.branch?.org_id;
    if (state(orgId).status === 'expired') return res.status(402).json({ error: 'The MediCore licence has ended. Your records are safe and can be viewed, but new entries are paused. Enter a licence key in Settings → Licence, or call Pentarch.' });
    next();
  });

  app.get('/api/licence', wrap(req => ({ ...state(req.user.org_id || req.branch?.org_id), plans: PLANS })));
  app.post('/api/licence/activate', H.adminOnly, wrap(req => {
    let p;
    try { p = verify(req.body.key); } catch (e) { fail(e.message); }
    const orgId = req.user.org_id || req.branch?.org_id;
    const org = R.get('SELECT * FROM orgs WHERE id=?', orgId);
    if (p.phone && org.phone && p.phone.replace(/\D/g, '').slice(-9) !== org.phone.replace(/\D/g, '').slice(-9)) fail(`This key was issued to ${p.org} (${p.phone}). It does not match this facility.`);
    if (p.until < today()) fail(`This key expired on ${p.until}. Ask Pentarch for a renewal key.`);
    rowFor(orgId);
    R.run("UPDATE licences SET key=?, plan=?, paid_until=?, status='active', updated_at=? WHERE org_id=?", req.body.key.trim(), p.plan, p.until, now(), orgId);
    return state(orgId);
  }));
  return { sign, verify, PLANS };
};
module.exports.sign = sign;
module.exports.verify = verify;
module.exports.PLANS = PLANS;
