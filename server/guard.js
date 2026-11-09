// Sign-in protection: salted PIN hashes and a slow-down after wrong PINs, so a 4-digit PIN cannot be guessed by trying them all
const crypto = require('crypto');

const legacy = pin => crypto.createHash('sha256').update('medicore:' + pin).digest('hex');
function hashPin(pin) {
  const salt = crypto.randomBytes(12).toString('hex');
  return 's1$' + salt + '$' + crypto.scryptSync(String(pin), salt, 32).toString('hex');
}
function verifyPin(stored, pin) {
  if (!stored) return false;
  pin = String(pin ?? '');
  if (stored.startsWith('s1$')) {
    const [, salt, h] = stored.split('$');
    const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pin, salt, 32);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return stored === legacy(pin);
}
const isLegacy = stored => !!stored && !stored.startsWith('s1$');

// wrong-PIN counter per account and per connection
const fails = new Map();
const WINDOW = 15 * 60e3;
function state(key) {
  const s = fails.get(key);
  if (!s || Date.now() - s.last > WINDOW) return { n: 0, last: 0, until: 0 };
  return s;
}
// throws a clear message while an account or connection is locked
function check(keys) {
  for (const k of keys) {
    const s = state(k);
    if (s.until > Date.now()) {
      const mins = Math.ceil((s.until - Date.now()) / 60e3);
      const e = new Error(`Too many wrong PINs. Try again in ${mins} minute${mins > 1 ? 's' : ''}, or ask your administrator to reset the PIN.`);
      e.status = 429; throw e;
    }
  }
}
function failed(keys) {
  for (const k of keys) {
    const s = state(k); s.n++; s.last = Date.now();
    const limit = k.startsWith('ip:') ? 30 : 5;
    if (s.n >= limit) s.until = Date.now() + Math.min(30, 2 ** (s.n - limit)) * 60e3;
    fails.set(k, s);
  }
}
function passed(keys) { for (const k of keys) if (!k.startsWith('ip:')) fails.delete(k); }
setInterval(() => { const t = Date.now(); for (const [k, s] of fails) if (t - s.last > WINDOW && s.until < t) fails.delete(k); }, 10 * 60e3).unref();

module.exports = { hashPin, verifyPin, isLegacy, check, failed, passed };
