import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchSessions } from '../lib/api';
import type { SearchResult } from '../lib/types';
import { Search, FileText, Wrench, Brain, Clock, SearchX } from 'lucide-react';

const HISTORY_KEY = 'opencode-search-history';
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}
function saveHistory(term: string) {
  const list = loadHistory().filter(h => h !== term);
  list.unshift(term);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
}

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const PART_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  text: FileText, reasoning: Brain, tool: Wrench,
};

interface GlobalSearchProps {
  onClose: () => void;
}

export default function GlobalSearch({ onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentSource = searchParams.get('source') || undefined;
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>(loadHistory);
  const debounced = useDebounce(query, 300);

  const buildUrl = (sessionId: string, projectId?: string, extra?: string) => {
    const params = new URLSearchParams();
    if (projectId && projectId !== 'global') params.set('project_id', projectId);
    if (currentSource) params.set('source', currentSource);
    const qs = params.toString();
    let url = `/sessions/${sessionId}`;
    if (extra) url += `?${extra}`;
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    return url;
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ['search', currentSource, debounced],
    queryFn: () => searchSessions({ q: debounced, per_page: 50, source: currentSource }),
    enabled: debounced.length > 0,
    staleTime: 60_000,
  });

  const grouped = useMemo(() => {
    if (!data?.rows) return [];
    const map = new Map<string, { id: string; title: string; project: string; projectId?: string; results: SearchResult[] }>();
    for (const r of data.rows) {
      if (!r.session_id) continue;
      const key = r.session_id;
      if (!map.has(key)) {
        map.set(key, { id: r.session_id, title: r.session_title, project: r.project_name ?? '', projectId: r.project_id, results: [] });
      }
      map.get(key)!.results.push(r);
    }
    return Array.from(map.entries()).map(([id, g]) => ({ id, ...g }));
  }, [data]);

  const handleSubmit = (term: string) => {
    if (!term.trim()) return;
    saveHistory(term);
    setHistory(loadHistory());
  };

  const highlight = (text: string, keyword: string) => {
    if (!keyword) return text;
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'var(--primary-glow)', color: 'var(--fg)', borderRadius: 2, padding: '0 2px' }}>
          {text.slice(idx, idx + keyword.length)}
        </mark>
        {text.slice(idx + keyword.length)}
      </>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
      justifyContent: 'center', paddingTop: '15vh',
      background: 'oklch(0% 0 0 / 0.5)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', boxShadow: '0 16px 64px oklch(0% 0 0 / 0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: 'var(--s-3) var(--s-4)', borderBottom: '1px solid var(--border-faint)' }}>
          <Search size={18} style={{ color: 'var(--fg-muted)' }} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && grouped.length > 0) {
                const first = grouped[0];
                handleSubmit(query);
                navigate(buildUrl(first.id, first.projectId));
                onClose();
              }
            }}
            placeholder="搜索会话、消息、代码..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--fg)', fontSize: 16, fontFamily: 'var(--font)',
            }}
          />
          {isLoading && <span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>搜索中...</span>}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 12 }}>Esc</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-2)' }}>
          {!debounced && history.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-dim)', padding: 'var(--s-2) var(--s-3)' }}>搜索历史</div>
              {history.map(h => (
                <div
                  key={h}
                  onClick={() => setQuery(h)}
                  style={{ padding: 'var(--s-1) var(--s-3)', fontSize: 13, color: 'var(--fg-muted)', cursor: 'pointer', borderRadius: 'var(--r)' }}
                >
                  <Clock size={12} style={{ marginRight: 'var(--s-2)' }} /> {h}
                </div>
              ))}
            </div>
          )}

          {debounced && !isLoading && grouped.length === 0 && (
            <div style={{ padding: 'var(--s-10) var(--s-6)', textAlign: 'center', color: 'var(--fg-dim)' }}>
              <SearchX size={28} style={{ opacity: 0.3, marginBottom: 'var(--s-3)' }} />
              <div style={{ fontSize: 14 }}>未找到匹配项</div>
              <div style={{ fontSize: 12, marginTop: 'var(--s-1)', opacity: 0.6 }}>尝试其他关键词</div>
            </div>
          )}

          {grouped.map(g => (
            <div key={g.id} style={{ marginBottom: 'var(--s-3)' }}>
              <div
                 onClick={() => { handleSubmit(query); navigate(buildUrl(g.id, g.projectId)); onClose(); }}
                style={{
                  padding: 'var(--s-2) var(--s-3)', cursor: 'pointer', borderRadius: 'var(--r)',
                  fontSize: 13, fontWeight: 600, color: 'var(--fg)',
                  display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
                }}
              >
                <FileText size={14} style={{ color: 'var(--primary)' }} />
                {g.title}
                {g.project && (
                  <span style={{ fontSize: 11, color: 'var(--fg-dim)', fontWeight: 400, marginLeft: 'auto' }}>
                    {g.project.split('/').pop()}
                  </span>
                )}
              </div>
              {g.results.slice(0, 3).map((r, i) => {
                const Icon = PART_ICONS[r.part_type] ?? FileText;
                return (
                  <div
                    key={r.part_id || `${r.session_id}_${i}`}
                    onClick={() => {
                      handleSubmit(query);
                       navigate(buildUrl(r.session_id, r.project_id, `msg=${r.message_id}`));
                      onClose();
                    }}
                    style={{
                      padding: 'var(--s-1) var(--s-3)', fontSize: 13, color: 'var(--fg-muted)',
                      cursor: 'pointer', borderRadius: 'var(--r)', paddingLeft: 'var(--s-8)',
                      display: 'flex', alignItems: 'flex-start', gap: 'var(--s-2)',
                    }}
                  >
                    <Icon size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {highlight(r.snippet, query)}
                    </span>
                  </div>
                );
              })}
              {g.results.length > 3 && (
                <div style={{ paddingLeft: 'var(--s-8)', fontSize: 11, color: 'var(--fg-dim)' }}>
                  ...还有 {g.results.length - 3} 条结果
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
