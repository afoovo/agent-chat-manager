import type { PartItem } from '../lib/types';
import { ToolCallPanel } from './ToolCallPanel';
import { ReasoningBlock } from './ReasoningBlock';
import { MarkdownRenderer } from './MarkdownRenderer';

interface PartRendererProps {
  part: PartItem;
  mode?: 'full' | 'compact';
}

export function PartRenderer({ part, mode = 'full' }: PartRendererProps) {
  switch (part.type) {
    case 'text':
      return <MarkdownRenderer content={part.text ?? ''} />;

    case 'reasoning':
      if (mode === 'compact') return null;
      return (
        <ReasoningBlock
          text={part.text ?? ''}
          time={part.time}
          tokens={part.tokens}
        />
      );

    case 'tool':
      if (mode === 'compact') return null;
      return (
        <ToolCallPanel
          tool={part.tool ?? 'unknown'}
          callID={part.callID ?? ''}
          state={part.state}
        />
      );

    case 'step-finish':
      if (!part.tokens && !part.cost) return null;
      return (
        <div style={{
          padding: 'var(--s-1) var(--s-3)', fontSize: 12, color: 'var(--fg-dim)',
          display: 'flex', gap: 'var(--s-4)', borderTop: '1px solid var(--border-faint)',
          marginTop: 'var(--s-3)', paddingTop: 'var(--s-2)',
        }}>
          {part.tokens && (
            <span>{part.tokens.input}+{part.tokens.output} tokens
              {part.tokens.reasoning ? ` (推理: ${part.tokens.reasoning})` : ''}
            </span>
          )}
          {part.cost !== undefined && part.cost > 0 && (
            <span>${part.cost.toFixed(4)}</span>
          )}
          {part.reason && <span>{part.reason}</span>}
        </div>
      );

    case 'patch':
      return (
        <div
          className="part-border-patch"
          style={{ padding: 'var(--s-2) var(--s-3)', margin: 'var(--s-2) 0', cursor: 'pointer', color: 'var(--fg-muted)', fontSize: 13 }}
          title="点击查看代码变更"
        >
          📄 {part.files?.length ?? 0} 个文件已修改
          {part.files && part.files.length <= 3 && (
            <div style={{ fontSize: 12, marginTop: 2 }}>
              {part.files.map((f, i) => (
                <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{f.split('/').pop()}</div>
              ))}
            </div>
          )}
        </div>
      );

    case 'compaction':
      return (
        <div className="time-separator" style={{ padding: 'var(--s-3) 0' }}>
          对话上下文已压缩 {part.auto ? '(自动)' : ''}
        </div>
      );

    case 'file':
      return (
        <a
          href={part.url ?? '#'}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s-2)', padding: 'var(--s-2) var(--s-3)', border: '1px solid var(--border-faint)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--primary)', textDecoration: 'none' }}
        >
          📎 {part.filename ?? '附件'} ({part.mime ?? 'unknown'})
        </a>
      );

    case 'step-start':
    default:
      return null;
  }
}
