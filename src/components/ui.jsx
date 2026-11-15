import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { useStore } from '../store.jsx';

/* ---------- Navigation ---------- */
export const NavContext = createContext({ page: 'dashboard', go: () => {} });
export const useNav = () => useContext(NavContext);

/* ---------- Modal ---------- */
export function Modal({ title, children, footer, onClose, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head row">
          <h2>{title}</h2>
          <div className="spacer" />
          {onClose && (
            <button className="btn ghost icon" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Confirm & prompt dialogs ---------- */
const DialogContext = createContext(null);
export const useDialog = () => useContext(DialogContext);

/* ---------- Toasts ---------- */
const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function UIProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [promptValue, setPromptValue] = useState('');

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setDialog({ type: 'confirm', ...opts, resolve });
      }),
    []
  );
  const prompt = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setPromptValue(opts.defaultValue || '');
        setDialog({ type: 'prompt', ...opts, resolve });
      }),
    []
  );
  const close = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  const toast = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || (opts.action ? 7000 : 3200));
  }, []);
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      <ToastContext.Provider value={toast}>
        {children}
        {dialog?.type === 'confirm' && (
          <Modal
            title={dialog.title}
            onClose={() => close(false)}
            footer={
              <>
                <button className="btn" onClick={() => close(false)}>
                  {dialog.cancelLabel || 'Cancel'}
                </button>
                <button className={`btn ${dialog.danger ? 'solid-danger' : 'primary'}`} autoFocus onClick={() => close(true)}>
                  {dialog.confirmLabel || 'Confirm'}
                </button>
              </>
            }
          >
            <p className="muted" style={{ whiteSpace: 'pre-line' }}>
              {dialog.message}
            </p>
          </Modal>
        )}
        {dialog?.type === 'prompt' && (
          <Modal
            title={dialog.title}
            onClose={() => close(null)}
            footer={
              <>
                <button className="btn" onClick={() => close(null)}>
                  Cancel
                </button>
                <button className="btn primary" disabled={!promptValue.trim()} onClick={() => close(promptValue.trim())}>
                  {dialog.confirmLabel || 'Save'}
                </button>
              </>
            }
          >
            <div className="field">
              {dialog.label && <label>{dialog.label}</label>}
              <input
                className="input"
                autoFocus
                value={promptValue}
                placeholder={dialog.placeholder}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && promptValue.trim() && close(promptValue.trim())}
              />
            </div>
          </Modal>
        )}
        <div className="toasts">
          {toasts.map((t) => (
            <div className="toast" key={t.id}>
              {t.tone === 'error' ? <CircleAlert size={16} color="var(--red)" /> : <CheckCircle2 size={16} color="var(--green-strong)" />}
              <span>{t.message}</span>
              <span className="spacer" />
              {t.action && (
                <button
                  className="btn sm"
                  onClick={() => {
                    t.action.run();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </DialogContext.Provider>
  );
}

/* ---------- Save status ---------- */
export function SaveIndicator() {
  const { saveState, data } = useStore();
  const label = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved changes', error: 'Save failed — retrying' }[saveState];
  return (
    <span className={`save-pill ${saveState}`} title={data.savedAt ? `Last saved ${new Date(data.savedAt).toLocaleString()}` : ''}>
      <span className="save-dot" />
      {label}
    </span>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="topbar">
      <div style={{ minWidth: 0 }}>
        <h1>{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      <div className="topbar-right">
        {children}
        <SaveIndicator />
      </div>
    </header>
  );
}

/* ---------- Inputs ---------- */
export function Field({ label, hint, children, style }) {
  return (
    <div className="field" style={style}>
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder, disabled, ...rest }) {
  return (
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) =>
        typeof o === 'string' ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        )
      )}
    </select>
  );
}

export function Segmented({ value, onChange, options, disabled }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} disabled={disabled} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Callout({ tone = 'info', title, children, icon }) {
  const Icon = icon || { good: Check, caution: AlertTriangle, warning: AlertTriangle, danger: CircleAlert, info: Info, missing: Info }[tone];
  return (
    <div className={`callout ${tone}`}>
      <Icon size={17} />
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function SourceTag({ kind }) {
  const map = {
    manual: ['Entered by you', 'grey'],
    weather: ['Weather service', 'blue'],
    research: ['Ground research', 'violet'],
    generated: ['Tactical recommendation', 'green'],
    sourced: ['Sourced statistic', 'violet'],
    missing: ['Missing information', 'amber'],
  };
  const [label, color] = map[kind] || map.manual;
  return <span className={`tag ${color} source-tag`}>{label}</span>;
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty-icon">
          <Icon size={26} />
        </div>
      )}
      <h3>{title}</h3>
      {children && <p style={{ maxWidth: 440 }}>{children}</p>}
      {action}
    </div>
  );
}

// Text input that keeps local state while typing and commits on change.
export function useDebounced(fn, delay = 300) {
  const t = useRef();
  return (...args) => {
    clearTimeout(t.current);
    t.current = setTimeout(() => fn(...args), delay);
  };
}
