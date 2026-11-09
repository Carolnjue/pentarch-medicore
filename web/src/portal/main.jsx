import React from 'react';
import { createRoot } from 'react-dom/client';
import Portal from './Portal';
import Try from './Try';
import './portal.css';

const path = location.pathname.replace(/\/+$/, '');
const App = path.startsWith('/try') ? Try : Portal;
createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost') {
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/portal-sw.js').catch(() => {}));
}
