import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Download, Star, AlertTriangle } from 'lucide-react';
import { getSessionDetail, getMessages, getImportSessionDetail, getImportMessages } from '../lib/api';
import { MessageBubble } from './MessageBubble';
import ExportDialog from './ExportDialog';
import { useBookmarks } from '../hooks/useBookmarks';
import type { MessageItem } from '../lib/types';

export default function ConversationView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const msgTarget = searchParams.get('msg');
  const source = searchParams.get('source') || undefined;
  const [mode, setMode] = useState<'full' | 'compact'>('full');
  const [page, setPage] = useState(1);
  const [showExport, setShowExport] = useState(false);
  const { bookmarks, toggleStar } = useBookmarks();

  const bm = (bookmarks as any[]).find((b: any) => b.session_id === id);
  const starred = bm?.starred ?? false;

  const { data: session, isError: sessionError, error: sessionErr } = useQuery({
    queryKey: ['session', source, id],
    queryFn: () => source
      ? getImportSessionDetail(source, id!)
      : getSessionDetail(id!),
    enabled: !!id,
  });

  const { data: msgData, isLoading, isError: msgError } = useQuery({
    queryKey: ['messages', source, id, page],
    queryFn: () => source
      ? getImportMessages(source, id!, page, 50)
      : getMessages(id!, page, 50),
    enabled: !!id,
  });

  const hasError = sessionError || msgError;

  const messages: MessageItem[] = msgData?.rows ?? [];
  const total = msgData?.total ?? 0;

  useEffect(() => {
    if (msgTarget && messages.length > 0) {
      const el = document.getElementById(`msg-${msgTarget}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.background = 'var(--primary-glow)';
        setTimeout(() => { el.style.background = ''; }, 2000);
      }
    }
  }, [msgTarget, messages]);

  if (isLoading) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'var(--s-6)', maxWidth: 800, margin: '0 auto', width: '100%' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 80, marginBottom: 16, width: `${70 + Math.random() * 30}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: 'var(--s-3) var(--s-4)', borderBottom: '1px solid var(--border-faint)',
        display: 'flex', alignItems: 'center', gap: 'var(--s-3)', background: 'var(--surface)',
      }}>
        <button
          onClick={() => { const qs = searchParams.toString(); navigate(qs ? `/sessions?${qs}` : '/sessions'); }}
          style={{ background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 16 }}
        >
          ← 返回
        </button>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session?.title ?? '加载中...'}
        </h2>
        <button
          onClick={() => id && toggleStar(id)}
          title={starred ? '取消星标' : '添加星标'}
          style={{ background: 'none', border: 'none', color: starred ? 'var(--warn)' : 'var(--fg-muted)', cursor: 'pointer', padding: 4 }}
        >
          <Star size={16} fill={starred ? 'var(--warn)' : 'none'} />
        </button>
        <button
          onClick={() => setShowExport(true)}
          title="导出对话"
          style={{ background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', padding: 4 }}
        >
          <Download size={16} />
        </button>
        <button
          onClick={() => setMode(m => m === 'full' ? 'compact' : 'full')}
          style={{
            padding: '4px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r)',
            background: 'var(--bg)', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 12,
          }}
        >
          {mode === 'full' ? '完整视图' : '简洁视图'}
        </button>
      </div>
      {hasError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          padding: 'var(--s-2) var(--s-4)', margin: '0 var(--s-3)',
          background: 'linear-gradient(135deg, oklch(80% 0.15 80 / 0.1), oklch(80% 0.15 80 / 0.05))',
          border: '1px solid oklch(80% 0.15 80 / 0.3)', borderRadius: 'var(--r)',
          fontSize: 12, color: 'var(--warn)',
        }}>
          <AlertTriangle size={14} />
          <span>部分内容加载失败，可能存在解析异常</span>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-6)', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            mode={mode}
            prevTime={i > 0 ? messages[i - 1].time_created : undefined}
          />
        ))}
        {page * 50 < total && (
          <div style={{ textAlign: 'center', padding: 'var(--s-4)' }}>
            <button
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: 'var(--s-2) var(--s-6)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
                background: 'var(--surface)', color: 'var(--fg-muted)', cursor: 'pointer',
              }}
            >
              加载更多 ({(page + 1) * 50 < total ? total - (page + 1) * 50 : total - page * 50} 条剩余)
            </button>
          </div>
        )}
      </div>
      {showExport && id && (
        <ExportDialog sessionId={id} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
