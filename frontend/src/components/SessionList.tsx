import { useState, useContext, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSessions, getImportSessions } from '../lib/api';
import { SearchContext } from '../App';
import type { SessionItem } from '../lib/types';
import { AGENT_COLORS } from '../lib/icons';
import { Cpu, Star, Search, FilterX } from 'lucide-react';
import { useBookmarks } from '../hooks/useBookmarks';
import { fmtTokens } from '../lib/utils';
import TagEditor from './TagEditor';

const TIME_PRESETS = [
  { label: '全部', days: 0 },
  { label: '今天', days: 1 },
  { label: '7天', days: 7 },
  { label: '30天', days: 30 },
] as const;

const AGENTS = [
  { label: '全部', value: '' },
  { label: 'build', value: 'build' },
  { label: 'general', value: 'general' },
  { label: 'explore', value: 'explore' },
] as const;

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  return `${months}月前`;
}

function isSameDay(ts: number, daysAgo: number): boolean {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo + 1);
  const target = d.getTime();
  return ts >= target && ts < target + 86400000;
}

export default function SessionList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openSearch = useContext(SearchContext);
  const projectId = searchParams.get('project_id') || undefined;
  const source = searchParams.get('source') || undefined;
  const agent = searchParams.get('agent') || undefined;
  const dateFrom = searchParams.get('date_from') ? Number(searchParams.get('date_from')) : undefined;
  const starred = searchParams.get('starred') === '1' || undefined;
  const tag = searchParams.get('tag') || undefined;
  const { toggleStar } = useBookmarks();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [allRows, setAllRows] = useState<SessionItem[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: SessionItem } | null>(null);
  const [tagEditorId, setTagEditorId] = useState<string | null>(null);

  const filterKey = `${projectId || ''}|${source || ''}|${agent || ''}|${dateFrom || ''}|${starred ? '1' : ''}|${tag || ''}`;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sessions', filterKey, page],
    queryFn: () => source
      ? getImportSessions(source, { page, per_page: 50, project_id: projectId, agent, date_from: dateFrom })
      : getSessions({ page, per_page: 50, project_id: projectId, agent, date_from: dateFrom, starred, tag }),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const hasMore = page * 50 < total;

  useEffect(() => {
    setPage(1);
    setAllRows([]);
  }, [filterKey]);

  useEffect(() => {
    if (rows.length > 0) {
      setAllRows(prev => {
        if (page === 1) return rows;
        const seen = new Set(prev.map(s => s.id));
        return [...prev, ...rows.filter(r => !seen.has(r.id))];
      });
    }
  }, [data]);

  const sessions = allRows.length > 0 ? allRows : rows;

  const handleContextMenu = (e: React.MouseEvent, s: SessionItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, session: s });
  };

  const closeContextMenu = () => setContextMenu(null);

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--s-6)' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, width: `${60 + Math.random() * 40}%` }} />
        ))}
      </div>
    );
  }

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value); else params.delete(key);
    navigate(`/sessions?${params.toString()}`);
  };

  const setTimePreset = (days: number) => {
    const params = new URLSearchParams(searchParams);
    if (days > 0) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - days + 1);
      params.set('date_from', String(d.getTime()));
    } else {
      params.delete('date_from');
    }
    navigate(`/sessions?${params.toString()}`);
  };

  const activePreset = dateFrom
    ? TIME_PRESETS.find(t => t.days > 0 && isSameDay(dateFrom, t.days))
    : TIME_PRESETS[0];

  return (
    <div style={{ padding: 'var(--s-4)', height: '100%', overflowY: 'auto' }} onClick={closeContextMenu}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginBottom: 'var(--s-2)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>会话列表</h1>
        <span style={{ color: 'var(--fg-dim)', fontSize: 13 }}>共 {total} 条</span>
      </div>
      <div style={{ display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        {AGENTS.map(a => (
          <button key={a.label} onClick={() => setFilter('agent', a.value)} style={{
            padding: '2px 10px', borderRadius: 12, border: (agent || '') === a.value ? '1px solid var(--primary)' : '1px solid var(--border)',
            background: (agent || '') === a.value ? 'var(--primary-glow)' : 'transparent',
            color: (agent || '') === a.value ? 'var(--primary)' : 'var(--fg-muted)',
            fontSize: 11, cursor: 'pointer', fontWeight: (agent || '') === a.value ? 500 : 400,
          }}>{a.label}</button>
        ))}
        <span style={{ color: 'var(--fg-dim)', fontSize: 10 }}>|</span>
        {TIME_PRESETS.map(t => (
          <button key={t.label} onClick={() => setTimePreset(t.days)} style={{
            padding: '2px 10px', borderRadius: 12, border: activePreset?.label === t.label ? '1px solid var(--primary)' : '1px solid var(--border)',
            background: activePreset?.label === t.label ? 'var(--primary-glow)' : 'transparent',
            color: activePreset?.label === t.label ? 'var(--primary)' : 'var(--fg-muted)',
            fontSize: 11, cursor: 'pointer', fontWeight: activePreset?.label === t.label ? 500 : 400,
          }}>{t.label}</button>
        ))}
        <span style={{ color: 'var(--fg-dim)', fontSize: 10 }}>|</span>
        <button onClick={() => setFilter('starred', starred ? '' : '1')} style={{
          padding: '2px 10px', borderRadius: 12, border: starred ? '1px solid var(--warn)' : '1px solid var(--border)',
          background: starred ? 'linear-gradient(135deg, oklch(80% 0.15 80 / 0.15), transparent)' : 'transparent',
          color: starred ? 'var(--warn)' : 'var(--fg-muted)', fontSize: 11, cursor: 'pointer',
          fontWeight: starred ? 500 : 400, display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <Star size={10} fill={starred ? 'var(--warn)' : 'none'} /> 星标
        </button>
        {(agent || dateFrom || starred) && (
          <button onClick={() => navigate('/sessions')} style={{
            padding: '2px 10px', border: 'none', background: 'transparent', color: 'var(--fg-dim)',
            cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 2,
          }}>
            <FilterX size={12} /> 清除
          </button>
        )}
      </div>
      <div onClick={openSearch} style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
        padding: '8px 14px', borderRadius: 8, marginBottom: 'var(--s-4)',
        background: 'var(--surface)', border: '1px solid var(--border)',
        cursor: 'text',
      }}>
        <Search size={14} style={{ color: 'var(--fg-dim)' }} />
        <span style={{ flex: 1, fontSize: 13, color: 'var(--fg-dim)' }}>搜索...</span>
        <kbd style={{
          padding: '1px 6px', borderRadius: 3, fontSize: 10,
          background: 'var(--bg)', border: '1px solid var(--border)',
          color: 'var(--fg-dim)', fontFamily: 'inherit',
        }}>Ctrl+K</kbd>
      </div>
      {!isLoading && sessions.length === 0 && (agent || dateFrom) && (
        <div style={{
          textAlign: 'center', padding: 'var(--s-10) var(--s-4)', color: 'var(--fg-dim)',
        }}>
          <FilterX size={32} style={{ opacity: 0.3, marginBottom: 'var(--s-4)' }} />
          <div style={{ fontSize: 14, marginBottom: 'var(--s-2)' }}>当前筛选条件下无会话</div>
          <button onClick={() => navigate('/sessions')} style={{
            marginTop: 'var(--s-2)', padding: '6px 16px', border: '1px solid var(--border)',
            borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--fg-muted)',
            cursor: 'pointer', fontSize: 12,
          }}>
            清除所有筛选
          </button>
        </div>
      )}
      {sessions.map((s: SessionItem) => (
        <div
          key={s.id}
          onContextMenu={(e) => handleContextMenu(e, s)}
          style={{
            padding: 'var(--s-3) var(--s-4)',
            borderBottom: '1px solid var(--border-faint)',
            cursor: 'pointer',
            transition: 'background var(--dur-fast) var(--ease-out)',
          }}
          onClick={() => {
            const qs = searchParams.toString();
            navigate(qs ? `/sessions/${s.id}?${qs}` : `/sessions/${s.id}`);
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-up)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 2 }}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleStar(s.id); }}
              title={s.starred ? '取消星标' : '添加星标'}
              style={{
                border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                color: s.starred ? 'var(--warn)' : 'var(--fg-dim)',
              }}
            >
              <Star size={14} fill={s.starred ? 'var(--warn)' : 'none'} />
            </button>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: AGENT_COLORS[s.agent ?? ''] ?? 'var(--fg-dim)',
            }} />
            <span style={{ fontWeight: 500, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.title}
            </span>
            <span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>
              {fmtRelative(s.time_created)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', fontSize: 12, color: 'var(--fg-muted)', paddingLeft: 30 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Cpu size={12} /> {s.provider_id}/{s.model_id}
            </span>
            <span>{fmtTokens(s.tokens_input + s.tokens_output)} tokens</span>
            {s.cost > 0 && <span>${s.cost.toFixed(2)}</span>}
            {s.tags && s.tags.length > 0 && (
              <span style={{ display: 'flex', gap: 4 }}>
                {s.tags.map((tag) => (
                  <span key={tag} style={{
                    padding: '0 6px', borderRadius: 'var(--r-full)', fontSize: 10,
                    background: 'var(--surface-up)', color: 'var(--fg-muted)',
                  }}>
                    {tag}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      ))}
      {hasMore && (
        <div style={{ textAlign: 'center', padding: 'var(--s-4)' }}>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={isFetching}
            style={{
              padding: 'var(--s-2) var(--s-6)', border: '1px solid var(--border)',
              borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--fg-muted)',
              cursor: isFetching ? 'wait' : 'pointer', fontSize: 13,
            }}
          >
            {isFetching ? '加载中...' : `加载更多 (${total - page * 50} 条剩余)`}
          </button>
        </div>
      )}

      {contextMenu && (
        <div
          style={{
            position: 'fixed', zIndex: 200,
            left: contextMenu.x, top: contextMenu.y,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            minWidth: 140, overflow: 'hidden',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setTagEditorId(contextMenu.session.id); closeContextMenu(); }}
            style={menuItemStyle}
          >
            编辑标签
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleStar(contextMenu.session.id); closeContextMenu(); }}
            style={menuItemStyle}
          >
            {contextMenu.session.starred ? '取消星标' : '添加星标'}
          </button>
        </div>
      )}

      {tagEditorId && (
        <TagEditor
          sessionId={tagEditorId}
          currentTags={sessions.find((s: SessionItem) => s.id === tagEditorId)?.tags ?? []}
          onClose={() => setTagEditorId(null)}
        />
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  width: '100%', padding: '8px 16px', border: 'none', background: 'transparent',
  color: 'var(--fg)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
  display: 'block',
};
