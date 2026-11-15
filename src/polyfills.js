// Small fallbacks so the app runs on older iPhones (iOS 12, e.g. iPhone 6).

// structuredClone arrived in Safari 15.4. Our data is plain JSON, so a JSON copy is equivalent.
if (typeof window !== 'undefined' && typeof window.structuredClone !== 'function') {
  window.structuredClone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
}

// Safari before 14.1 ignores "gap" in flex layouts. Detect it and let CSS add spacing instead.
if (typeof document !== 'undefined') {
  try {
    const flex = document.createElement('div');
    flex.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden';
    flex.appendChild(document.createElement('div'));
    flex.appendChild(document.createElement('div'));
    document.documentElement.appendChild(flex);
    const ok = flex.scrollHeight === 1;
    flex.remove();
    if (!ok) document.documentElement.classList.add('no-flex-gap');
  } catch {
    /* ignore */
  }
}
