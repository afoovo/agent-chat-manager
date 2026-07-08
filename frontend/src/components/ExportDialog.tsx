import { useState } from 'react';
import { X, Download, FileText, Globe } from 'lucide-react';
import { exportSession, exportSessions } from '../lib/api';

interface Props {
  sessionId: string;
  sessionIds?: string[];
  onClose: () => void;
}

export default function ExportDialog({ sessionId, sessionIds, onClose }: Props) {
  const [format, setFormat] = useState<'md' | 'html'>('md');
  const [exporting, setExporting] = useState(false);
  const ids = sessionIds && sessionIds.length > 0 ? sessionIds : [sessionId];
  const isBatch = ids.length > 1;

  const handleExport = async () => {
    setExporting(true);
    try {
      let res;
      if (isBatch) {
        res = await exportSessions(ids, format);
      } else {
        res = await exportSession(sessionId, format);
      }
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = isBatch ? 'sessions_export.zip' : `session_${sessionId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      console.error('导出失败', e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 400, background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--s-3) var(--s-4)', borderBottom: '1px solid var(--border-faint)',
        }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {isBatch ? `导出 ${ids.length} 个会话` : '导出会话'}
          </span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', color: 'var(--fg-dim)', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 'var(--s-4)' }}>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 'var(--s-3)' }}>
            选择导出格式：
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
            <button
              onClick={() => setFormat('md')}
              style={{
                flex: 1, padding: 'var(--s-4)', border: format === 'md' ? '2px solid var(--primary)' : '1px solid var(--border-faint)',
                borderRadius: 'var(--r)', background: format === 'md' ? 'var(--primary-glow)' : 'var(--bg)',
                color: 'var(--fg)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 'var(--s-2)', textAlign: 'center',
              }}
            >
              <FileText size={24} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>Markdown</span>
              <span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>.md 文件</span>
            </button>
            <button
              onClick={() => setFormat('html')}
              style={{
                flex: 1, padding: 'var(--s-4)', border: format === 'html' ? '2px solid var(--primary)' : '1px solid var(--border-faint)',
                borderRadius: 'var(--r)', background: format === 'html' ? 'var(--primary-glow)' : 'var(--bg)',
                color: 'var(--fg)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 'var(--s-2)', textAlign: 'center',
              }}
            >
              <Globe size={24} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>HTML</span>
              <span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>独立打开</span>
            </button>
          </div>
        </div>

        <div style={{ padding: 'var(--s-3) var(--s-4)', borderTop: '1px solid var(--border-faint)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: 'var(--s-2) var(--s-6)', border: 'none', borderRadius: 'var(--r)',
              background: 'var(--primary)', color: '#fff', cursor: exporting ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
              opacity: exporting ? 0.7 : 1,
            }}
          >
            <Download size={14} />
            {exporting ? '导出中...' : '导出'}
          </button>
        </div>
      </div>
    </div>
  );
}
