// Fetch JSON either through the desktop app (main process) or directly in a browser.
export async function getJson(url) {
  if (typeof window !== 'undefined' && window.desktop?.getJson) {
    const res = await window.desktop.getJson(url);
    if (!res.ok) throw new Error(res.error || 'Request failed');
    return res.data;
  }
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('No internet connection or the service is unavailable.');
  }
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export function openExternal(url) {
  if (window.desktop?.openExternal) window.desktop.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}
