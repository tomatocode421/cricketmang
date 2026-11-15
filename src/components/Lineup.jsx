import { useState } from 'react';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

// Drag-and-drop list. renderRow(row, index) returns the cells after the handle.
export default function Lineup({ rows, columns, header, onMove, renderRow }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [drop, setDrop] = useState(null); // { index, after }

  const end = () => {
    setDragIndex(null);
    setDrop(null);
  };

  return (
    <div className="panel" style={{ overflow: 'hidden' }}>
      <div className="lineup-head" style={{ gridTemplateColumns: columns }}>
        <span />
        {header.map((h, i) => (
          <span key={i}>{h}</span>
        ))}
      </div>
      {rows.map((row, i) => {
        const cls = ['lineup-row'];
        if (dragIndex === i) cls.push('dragging');
        if (drop && drop.index === i && dragIndex !== null && dragIndex !== i) cls.push(drop.after ? 'drop-after' : 'drop-before');
        return (
          <div
            key={i}
            className={cls.join(' ')}
            style={{ gridTemplateColumns: columns }}
            draggable={dragIndex === i}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(i));
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              setDrop({ index: i, after: e.clientY > rect.top + rect.height / 2 });
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null && drop) {
                let to = drop.index + (drop.after ? 1 : 0);
                if (dragIndex < to) to -= 1;
                if (to !== dragIndex) onMove(dragIndex, to);
              }
              end();
            }}
            onDragEnd={end}
          >
            <span className="handle-cell">
              <span className="drag-handle" title="Drag to reorder" onMouseDown={() => setDragIndex(i)} onMouseUp={() => dragIndex === i && end()}>
                <GripVertical size={17} />
              </span>
              <span className="move-btns">
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => onMove(i, i - 1)}>
                  <ChevronUp size={16} />
                </button>
                <button type="button" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => onMove(i, i + 1)}>
                  <ChevronDown size={16} />
                </button>
              </span>
            </span>
            {renderRow(row, i)}
          </div>
        );
      })}
    </div>
  );
}
