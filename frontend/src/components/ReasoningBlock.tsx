import { useState } from 'react';
import type { TokenInfo } from '../lib/types';

interface ReasoningBlockProps {
  text: string;
  time?: { start: number; end: number };
  tokens?: TokenInfo;
}

export function ReasoningBlock({ text, time, tokens }: ReasoningBlockProps) {
  const [open, setOpen] = useState(false);
  const duration = time ? ((time.end - time.start) / 1000).toFixed(0) : null;

  return (
    <div className="part-border-reasoning" style={{ margin: 'var(--s-2) 0', paddingLeft: 'var(--s-3)' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          fontSize: 13, color: 'var(--fg-muted)', userSelect: 'none', padding: 'var(--s-1) 0',
        }}
      >
        <span style={{ transition: 'transform var(--dur-fast)', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▸</span>
        <span>思考中</span>
        {duration && <span>({duration}s)</span>}
        {tokens && <span style={{ color: 'var(--fg-dim)' }}>· {tokens.input ?? tokens.total ?? 0} tokens</span>}
        {text && !open && (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--fg-dim)' }}>
            {text.slice(0, 80)}...
          </span>
        )}
      </div>
      {open && (
        <div style={{
          padding: 'var(--s-2) 0 var(--s-3)', fontSize: 13, color: 'var(--fg-muted)',
          lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {text}
        </div>
      )}
    </div>
  );
}
