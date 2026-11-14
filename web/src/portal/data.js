export const LOGO = '/pentarch-logo.png';
export const LOGO_WHITE = '/pentarch-logo-white.png';
export const SITE = 'https://pentarchsystemssolutions.co.ke';
export const PHONE = '+254 729 455 912';
export const PHONE_WA = '254729455912';
export const EMAIL = 'info@pentarchsystemssolutions.co.ke';

export const COUNTIES = ['Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'];

export const TYPES = [
  ['pharmacy', 'Pharmacy / chemist'],
  ['clinic', 'Clinic / medical centre'],
  ['hospital', 'Hospital / nursing home'],
];
export const typeLabel = t => (TYPES.find(x => x[0] === t) || [, t || 'Facility'])[1];

export const STAGES = [
  ['lead', 'New lead', '#646E82'],
  ['contacted', 'Contacted', '#1F3C7A'],
  ['demo', 'Demo booked', '#7A4BC2'],
  ['trial', 'On 30-day demo', '#14B1AC'],
  ['negotiating', 'Negotiating', '#F6B22C'],
  ['won', 'Won', '#16A34A'],
  ['lost', 'Lost', '#EE4B3B'],
];
export const stage = s => STAGES.find(x => x[0] === s) || STAGES[0];

export const ACTS = [
  ['call', 'Phone call'],
  ['visit', 'Visit'],
  ['whatsapp', 'WhatsApp'],
  ['demo', 'Demo shown'],
  ['note', 'Note'],
];
export const ROLES = ['Owner', 'Superintendent pharmacist', 'Pharmacist', 'Pharm tech', 'Medical director', 'Clinical officer', 'Administrator', 'Manager', 'Accountant', 'Other'];
export const LOST = ['Price too high', 'Already has a system', 'Not ready yet', 'No computer', 'Owner not reachable', 'Chose a competitor', 'Other'];

export const KES = n => 'KES ' + Math.round(Number(n) || 0).toLocaleString('en-KE');
export const fmtDate = d => { if (!d) return ''; const x = new Date(String(d).length <= 10 ? d + 'T00:00:00' : d); return isNaN(x) ? d : x.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: x.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }); };
export const ago = d => {
  if (!d) return '';
  const s = (Date.now() - new Date(String(d).length <= 10 ? d + 'T00:00:00' : d)) / 1000;
  if (s < 90) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago';
  if (s < 86400 * 30) return Math.round(s / 86400) + ' d ago'; return fmtDate(d);
};
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const waLink = (phone, text) => `https://wa.me/${String(phone || '').replace(/\D/g, '').replace(/^0/, '254')}?text=${encodeURIComponent(text)}`;
export const telLink = phone => 'tel:' + String(phone || '').replace(/\s/g, '');
