import { useState } from 'react';
import { parseUnifiedDiff, type DiffFile } from '../lib/diffParser';
import { FileText, ArrowLeftRight } from 'lucide-react';

interface Props {
  diffFiles: { file: string; patch: string; additions: number; deletions: number; status: string }[] | null;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  modified: 'var(--warn)',
  added: 'var(--ok)',
  deleted: 'var(--err)',
};

export default function DiffViewer({ diffFiles, onClose }: Props) {
  const [selectedFile, setSelectedFile] = useState(0);

  const files: DiffFile[] = [];
  if (diffFiles) {
    for (const f of diffFiles) {
      if (f.patch) {
        const parsed = parseUnifiedDiff(f.patch);
        if (parsed.length > 0) {
          for (const pf of parsed) {
            files.push({ ...pf, status: f.status as DiffFile['status'] });
          }
        }
      }
    }
  }

  const current = files[selectedFile];

  if (files.length === 0) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>代码差异</span>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>
        <div style={{ padding: 'var(--s-6)', textAlign: 'center', color: 'var(--fg-muted)' }}>
          无代码变更
        </div>
      </div>
    );
  }

  const addCount = current.hunks.reduce((sum, h) => sum + h.lines.filter(l => l.type === 'add').length, 0);
  const rmCount = current.hunks.reduce((sum, h) => sum + h.lines.filter(l => l.type === 'remove').length, 0);

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>代码差异</span>
        <button onClick={onClose} style={closeBtnStyle}>×</button>
      </div>

      {files.length > 1 && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-faint)', overflowX: 'auto' }}>
          {files.map((f, i) => (
            <button
              key={i}
              onClick={() => setSelectedFile(i)}
              style={{
                padding: 'var(--s-1) var(--s-3)',
                border: 'none',
                borderBottom: i === selectedFile ? '2px solid var(--primary)' : '2px solid transparent',
                background: i === selectedFile ? 'var(--surface-up)' : 'transparent',
                color: i === selectedFile ? 'var(--fg)' : 'var(--fg-muted)',
                cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <FileText size={12} />
              {f.filename.split('/').pop()}
              <span style={{ color: STATUS_COLORS[f.status] || 'var(--fg-dim)' }}>{f.status}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: 'var(--s-2) var(--s-3)', fontSize: 12, color: 'var(--fg-muted)',
                    borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
        <ArrowLeftRight size={12} />
        <span>{current.filename}</span>
        <span style={{ color: 'var(--ok)' }}>+{addCount}</span>
        <span style={{ color: 'var(--err)' }}>-{rmCount}</span>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6 }}>
          <tbody>
            {current.hunks.map((hunk, hi) => (
              <HunkBlock key={hi} hunk={hunk} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HunkBlock({ hunk }: { hunk: DiffFile['hunks'][number] }) {
  return (
    <>
      <tr style={{ background: 'var(--surface-up)' }}>
        <td colSpan={3} style={{ padding: '2px var(--s-3)', fontSize: 10, color: 'var(--fg-dim)' }}>
          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
        </td>
      </tr>
      {hunk.lines.map((line, i) => {
        const bg = line.type === 'add' ? 'var(--diff-add)' :
                   line.type === 'remove' ? 'var(--diff-del)' : 'transparent';
        const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
        const color = line.type === 'add' ? 'var(--ok)' :
                      line.type === 'remove' ? 'var(--err)' : 'var(--fg-dim)';
        const oldLn = line.type === 'add' ? '' : (line.oldLineNumber ?? '');
        const newLn = line.type === 'remove' ? '' : (line.newLineNumber ?? '');
        return (
          <tr key={i} style={{ background: bg }}>
            <td style={{ width: 40, textAlign: 'right', padding: '0 8px', color: 'var(--fg-dim)', userSelect: 'none' }}>
              {oldLn}
            </td>
            <td style={{ width: 40, textAlign: 'right', padding: '0 8px', color: 'var(--fg-dim)', userSelect: 'none' }}>
              {newLn}
            </td>
            <td style={{ width: 20, textAlign: 'center', color, userSelect: 'none' }}>{prefix}</td>
            <td style={{ padding: '0 var(--s-3)', whiteSpace: 'pre' }}>{line.content}</td>
          </tr>
        );
      })}
    </>
  );
}

const panelStyle: React.CSSProperties = {
  width: '45%',
  minWidth: 400,
  borderLeft: '1px solid var(--border)',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: 'var(--s-3)', borderBottom: '1px solid var(--border-faint)',
};

const closeBtnStyle: React.CSSProperties = {
  border: 'none', background: 'transparent', color: 'var(--fg-muted)',
  cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0,
};
