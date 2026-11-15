import { useMemo, useRef, useState } from 'react';
import { Copy, Share2, Check } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Modal, useToast } from './ui.jsx';
import { teamSheet } from '../data/model.js';
import { POSITIONS } from '../data/positions.js';

// Shows the match line-up as text that can be copied or shared to the team.
export default function TeamSheetModal({ match, onClose }) {
  const { data } = useStore();
  const toast = useToast();
  const text = useMemo(() => teamSheet(match, data.players, { POSITIONS }), [match, data.players]);
  const [value, setValue] = useState(text);
  const [copied, setCopied] = useState(false);
  const area = useRef();
  const canShare = typeof navigator !== 'undefined' && !!navigator.share && !window.desktop;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast('Team sheet copied — paste it into your team chat');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      area.current?.select();
      toast('Select all and copy the text below', { tone: 'error' });
    }
  };
  const share = async () => {
    try {
      await navigator.share({ text: value });
    } catch {
      /* cancelled */
    }
  };

  return (
    <Modal
      wide
      title="Team sheet"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Close
          </button>
          {canShare && (
            <button className="btn" onClick={share}>
              <Share2 size={15} /> Share…
            </button>
          )}
          <button className="btn primary" onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy text'}
          </button>
        </>
      }
    >
      <div className="stack-sm">
        <p className="muted small">Your batting order, bowling plan and field as a message for the team. You can edit it here before copying; your match isn&apos;t changed.</p>
        <textarea ref={area} className="textarea team-sheet" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Team sheet text" spellCheck={false} />
      </div>
    </Modal>
  );
}
