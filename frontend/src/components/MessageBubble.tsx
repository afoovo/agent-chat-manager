import type { MessageItem } from '../lib/types';
import { PartRenderer } from './PartRenderer';
import { AGENT_COLORS } from '../lib/icons';
import { Cpu } from 'lucide-react';

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

interface MessageBubbleProps {
  msg: MessageItem;
  mode: 'full' | 'compact';
  prevTime?: number;
}

export function MessageBubble({ msg, mode, prevTime }: MessageBubbleProps) {
  const gap = prevTime ? msg.time_created - prevTime : Infinity;
  const showSeparator = prevTime && gap > 5 * 60 * 1000;

  if (msg.role === 'user') {
    const firstPart = msg.parts[0];
    const text = firstPart?.text ?? '';
    return (
      <div id={`msg-${msg.id}`}>
        {showSeparator && <div className="time-separator">{fmtTime(msg.time_created)}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--s-4)' }}>
          <div className="user-bubble">
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginTop: 'var(--s-2)', fontSize: 11, color: 'var(--fg-dim)' }}>
              <span>{fmtTime(msg.time_created)}</span>
              {msg.agent && (
                <span style={{
                  padding: '0 4px', borderRadius: 3, fontSize: 10,
                  background: AGENT_COLORS[msg.agent] ? `${AGENT_COLORS[msg.agent]}33` : 'var(--surface-up)',
                  color: AGENT_COLORS[msg.agent] ?? 'var(--fg-muted)',
                }}>
                  {msg.agent}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (msg.role === 'assistant') {
    return (
      <div id={`msg-${msg.id}`}>
        {showSeparator && <div className="time-separator">{fmtTime(msg.time_created)}</div>}
        <div style={{ marginBottom: 'var(--s-6)' }}>
          {msg.parts.map((part, i) => (
            <PartRenderer key={part.id || i} part={part} mode={mode} />
          ))}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginTop: 'var(--s-2)',
            fontSize: 11, color: 'var(--fg-dim)',
          }}>
            <span>{fmtTime(msg.time_created)}</span>
            {msg.model_id && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Cpu size={10} /> {msg.provider_id}/{msg.model_id}
              </span>
            )}
            {msg.tokens && (
              <span>{msg.tokens.input}+{msg.tokens.output} tokens</span>
            )}
            {msg.cost && msg.cost > 0 && (
              <span>${msg.cost.toFixed(4)}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
