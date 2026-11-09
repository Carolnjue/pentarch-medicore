// Pentarch MediCore price list (KES). One place for the app, the sales portal and the sales guide.
module.exports = {
  updated: '2026-11-09',
  plans: {
    pharmacy: { label: 'Pharmacy', monthly: 2500, yearly: 25000, setup: 10000, for: 'Retail pharmacies and chemists, with or without a lab' },
    clinic: { label: 'Clinic', monthly: 5000, yearly: 50000, setup: 15000, for: 'Clinics, medical centres and maternity homes' },
    hospital: { label: 'Hospital', monthly: 12000, yearly: 120000, setup: 40000, for: 'Nursing homes and hospitals with wards and theatre' },
  },
  extraBranch: 'Each extra branch pays its own plan; 15% off every branch from the third.',
  kit: {
    name: 'MediCore Counter Kit', price: 85000,
    note: 'Everything for one checkout counter, delivered, installed and staff trained. Software plan is separate.',
    items: [
      ['Computer', 'HP EliteDesk 800 G3 Mini (renewed), Core i5, 8 GB RAM, 256 GB SSD, with 19" monitor, keyboard and mouse'],
      ['Barcode scanner', 'Honeywell Youjie HH360 2D USB (reads box barcodes and the 2D codes on medicine packs)'],
      ['Receipt printer', 'Xprinter XP-T80A, 80 mm thermal, USB + network, automatic cutter'],
      ['Cash drawer', '5-note, 8-coin drawer that opens from the receipt printer'],
      ['Power backup', 'Mecer ME-650-VU 650 VA UPS (about 15 minutes for the computer and router)'],
      ['Wi-Fi router', 'TP-Link TL-WR840N, for phones and tablets in the facility'],
      ['Supplies', '10 rolls of 80 mm receipt paper'],
    ],
  },
  addons: [
    ['Barcode label printer', 'Xprinter XP-370B + 1 roll of 1,000 labels', 12500],
    ['Extra workstation (consultation or lab)', 'Samsung Galaxy Tab A9+ 11" tablet', 30000],
    ['Internet backup', 'Safaricom 4G Wi-Fi router (keeps cloud backup and M-Pesa prompts working when the line is down)', 4500],
    ['Extra training day', 'On site, up to 6 staff', 5000],
  ],
  commission: { softwareRate: 0.20, kitBonus: 5000, note: '20% of the client\'s first-year software fees (paid as the client pays) plus KES 5,000 for every Counter Kit installed.' },
  demoDays: 30,
};
