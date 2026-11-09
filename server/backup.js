// Backup and restore for one organisation: every branch's records plus its staff and settings, in one compressed file.
// Works the same offline (download to a flash drive) and on the Pentarch cloud (each facility only ever sees its own data).
const zlib = require('zlib');
const express = require('express');

module.exports = function backup(app, H) {
  const { D, R, wrap, fail, now, adminOnly, audit } = H;

  // Daily safety copy of every database on this computer or server, kept for 7 days in data/backups.
  // It protects against a damaged file or a mistake; the downloaded .mcbak protects against losing the computer.
  const fs = require('fs'), path = require('path');
  const AUTO = path.join(D.DATA_DIR, 'backups');
  function autoBackup() {
    try {
      const day = new Date().toISOString().slice(0, 10), dir = path.join(AUTO, day);
      if (fs.existsSync(path.join(dir, 'registry.db'))) return;
      fs.mkdirSync(dir, { recursive: true });
      R.exec(`VACUUM INTO '${path.join(dir, 'registry.db').replace(/'/g, "''")}'`);
      for (const b of R.all('SELECT b.id FROM branches b LEFT JOIN orgs o ON o.id=b.org_id WHERE COALESCE(o.demo,0)=0')) D.openBranch(b.id).exec(`VACUUM INTO '${path.join(dir, `branch-${b.id}.db`).replace(/'/g, "''")}'`);
      for (const old of fs.readdirSync(AUTO).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(0, -7)) fs.rmSync(path.join(AUTO, old), { recursive: true, force: true });
      console.log('Automatic backup saved to', dir);
    } catch (e) { console.error('Automatic backup failed:', e.message); }
  }
  setTimeout(autoBackup, Number(process.env.MEDICORE_AUTOBACKUP_DELAY || 60e3)).unref();
  setInterval(autoBackup, 3 * 3600e3).unref();
  app.get('/api/backup/auto', adminOnly, wrap(() => ({ cloud: process.env.MEDICORE_CLOUD === '1', days: fs.existsSync(AUTO) ? fs.readdirSync(AUTO).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse() : [] })));

  const tables = db => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
  const dump = db => Object.fromEntries(tables(db).map(t => [t, db.prepare(`SELECT * FROM "${t}"`).all()]));
  const orgOf = req => req.user.org_id || req.branch?.org_id;

  app.get('/api/backup', adminOnly, (req, res) => {
    try {
      const orgId = orgOf(req);
      const org = R.get('SELECT * FROM orgs WHERE id=?', orgId);
      if (!org) return res.status(400).json({ error: 'No facility to back up' });
      const branches = R.all('SELECT * FROM branches WHERE org_id=?', orgId);
      const data = {
        kind: 'pentarch-medicore-backup', version: 1, made_at: now(), made_by: req.user.name,
        org, branches, users: R.all('SELECT * FROM users WHERE org_id=?', orgId), licence: R.get('SELECT * FROM licences WHERE org_id=?', orgId) || null,
        branch_data: Object.fromEntries(branches.map(b => [b.id, dump(D.openBranch(b.id))])),
      };
      if (req.branch) D.use(req.branch.id);
      const gz = zlib.gzipSync(Buffer.from(JSON.stringify(data)));
      for (const b of branches) { try { D.use(b.id); D.setConfig({ ...(D.getConfig() || {}), last_backup: now() }); } catch {} }
      if (req.branch) D.use(req.branch.id);
      audit(req, 'backup downloaded', 'org', orgId);
      const name = `MediCore-backup-${(org.name || 'facility').replace(/[^A-Za-z0-9]+/g, '-')}-${now().slice(0, 10)}.mcbak`;
      res.set({ 'content-type': 'application/gzip', 'content-disposition': `attachment; filename="${name}"` }).send(gz);
    } catch (e) { res.status(500).json({ error: 'Backup failed: ' + e.message }); }
  });

  // Restore replaces every record in this organisation's branches with the copy in the file
  app.post('/api/restore', adminOnly, express.raw({ type: () => true, limit: '300mb' }), wrap(req => {
    let data;
    try { data = JSON.parse(zlib.gunzipSync(req.body).toString()); } catch { fail('That is not a MediCore backup file'); }
    if (data.kind !== 'pentarch-medicore-backup') fail('That is not a MediCore backup file');
    const orgId = orgOf(req);
    const mine = R.all('SELECT * FROM branches WHERE org_id=?', orgId);
    const map = {};
    for (const b of data.branches) {
      const target = mine.find(m => m.id === b.id) || mine.find(m => m.name === b.name);
      if (!target) fail(`The backup has a branch "${b.name}" that is not in this facility. Add a branch with that name first, or ask Pentarch.`);
      map[b.id] = target.id;
    }
    for (const [fromId, toId] of Object.entries(map)) {
      const db = D.openBranch(toId);
      const tabs = tables(db);
      db.exec('BEGIN');
      try {
        for (const t of tabs) db.prepare(`DELETE FROM "${t}"`).run();
        for (const [t, rows] of Object.entries(data.branch_data[fromId] || {})) {
          if (!tabs.includes(t) || !rows.length) continue;
          const cols = db.prepare(`PRAGMA table_info("${t}")`).all().map(c => c.name);
          const use = Object.keys(rows[0]).filter(c => cols.includes(c));
          const st = db.prepare(`INSERT INTO "${t}"(${use.map(c => `"${c}"`).join(',')}) VALUES(${use.map(() => '?').join(',')})`);
          for (const r of rows) st.run(...use.map(c => r[c]));
        }
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); fail('Restore stopped, nothing changed in that branch: ' + e.message); }
    }
    if (req.branch) D.use(req.branch.id);
    audit(req, 'restored backup from ' + data.made_at, 'org', orgId);
    return { ok: true, branches: Object.keys(map).length, made_at: data.made_at };
  }));
};
