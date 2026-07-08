import { useState } from 'react';
import type { ToolState } from '../lib/types';
import { Wrench, Terminal, FileText, Edit, Pen, Search, FolderSearch, Bot, HelpCircle, Globe } from 'lucide-react';

interface ToolCallPanelProps {
  tool: string;
  callID: string;
  state?: ToolState;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  bash: Terminal, read: FileText, write: Edit, edit: Pen,
  grep: Search, glob: FolderSearch, task: Bot, question: HelpCircle,
  webfetch: Globe,
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'var(--ok)',
  error: 'var(--err)',
  running: 'var(--warn)',
};

export function ToolCallPanel({ tool, state }: ToolCallPanelProps) {
  const [open, setOpen] = useState(false);
  const status = state?.status ?? 'unknown';
  const title = state?.title ?? tool;
  const duration = state?.time ? ((state.time.end - state.time.start)).toFixed(0) : null;
  const IconComp = ICON_MAP[tool] ?? Wrench;

  return (
    <div className="part-border-tool" style={{ margin: 'var(--s-2) 0', paddingLeft: 'var(--s-3)' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          fontSize: 13, color: 'var(--fg-muted)', userSelect: 'none', padding: 'var(--s-1) 0',
        }}
      >
        <span style={{ transition: 'transform var(--dur-fast)', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▸</span>
        <IconComp size={13} />
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)' }}>{tool}</span>
        <span>· {title}</span>
        {duration && <span style={{ color: 'var(--fg-dim)' }}>{duration}ms</span>}
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: STATUS_COLORS[status] ?? 'var(--fg-dim)',
        }} />
      </div>
      {open && (
        <div style={{ padding: 'var(--s-2) 0' }}>
          {state?.input && (
            <div style={{ marginBottom: 'var(--s-2)' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginBottom: 2 }}>输入</div>
              <div className="tool-output" style={{ maxHeight: 200 }}>
                {typeof state.input === 'string' ? state.input : JSON.stringify(state.input, null, 2)}
              </div>
            </div>
          )}
          {state?.output != null && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginBottom: 2 }}>输出</div>
              <div className="tool-output">
                {String(state.output)}
              </div>
              {String(state.output).length > 2000 && (
                <button style={{
                  background: 'none', border: 'none', color: 'var(--primary)',
                  cursor: 'pointer', fontSize: 12, padding: 'var(--s-1) 0',
                }} onClick={() => alert('完整内容:\n' + String(state.output))}>
                  查看完整内容
                </button>
              )}
            </div>
          )}
          {state?.metadata && (
            <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 'var(--s-2)', display: 'flex', gap: 'var(--s-3)' }}>
              {state.metadata.exit !== undefined && <span>exit: {state.metadata.exit}</span>}
              {state.metadata.truncated && <span style={{ color: 'var(--warn)' }}>输出已截断</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
