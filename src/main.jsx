import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

// Installed iPhone/iPad version: work offline and ask the browser to keep data safe.
if (typeof window !== 'undefined' && !window.desktop && /^https?:$/.test(location.protocol)) {
  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
  navigator.storage?.persist?.().catch(() => {});
}
