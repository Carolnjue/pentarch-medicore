// Fetch wrapper for the MediCore local server: carries the session token and the selected branch
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let session = store.get('mc_session'); // { token, user, org, branches }
let branchId = store.get('mc_branch');
let onExpired = () => {};

export const getSession = () => session;
export const getBranchId = () => branchId;
export function setSession(s) { session = s; store.set('mc_session', s); if (!s) setBranch(null); }
export function setBranch(id) { branchId = id; store.set('mc_branch', id); }
export function onSessionExpired(fn) { onExpired = fn; }

async function call(method, url, body) {
  let res;
  try {
    res = await fetch('/api' + url, {
      method,
      headers: { 'content-type': 'application/json', 'x-token': session?.token || '', 'x-branch': branchId || '' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // the server could not be reached at all: say what to check rather than a browser error
    const online = /pentarchcommunications\.com$/.test(location.hostname);
    throw new Error(online ? 'Cannot reach MediCore. Check this device\'s internet connection and try again.'
      : 'Cannot reach the MediCore computer. Check that it is switched on with the black MediCore window open, and that this device is on the same Wi-Fi.');
  }
  if (res.status === 502 || res.status === 503) throw new Error('MediCore is restarting. Wait a few seconds and try again.');
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && session && url !== '/login') { setSession(null); onExpired(); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

export const api = {
  get: url => call('GET', url),
  post: (url, body) => call('POST', url, body || {}),
  put: (url, body) => call('PUT', url, body || {}),
  del: (url, body) => call('DELETE', url, body || {}),
};
