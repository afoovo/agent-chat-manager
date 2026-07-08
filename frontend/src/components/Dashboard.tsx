import { useState, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Database } from 'lucide-react';
import { SearchContext } from '../App';
import { getStatsOverview } from '../lib/api';
import OverviewPanel from './DashboardPanels/OverviewPanel';
import ProjectPanel from './DashboardPanels/ProjectPanel';
import ModelPanel from './DashboardPanels/ModelPanel';
import AgentPanel from './DashboardPanels/AgentPanel';
import TimelinePanel from './DashboardPanels/TimelinePanel';
import ToolUsagePanel from './DashboardPanels/ToolUsagePanel';

const TABS = [
  { key: 'project', label: '项目' },
  { key: 'model', label: '模型' },
  { key: 'agent', label: 'Agent' },
  { key: 'timeline', label: '时间趋势' },
  { key: 'tool', label: '工具使用' },
];

export default function Dashboard() {
  const [tab, setTab] = useState('project');
  const openSearch = useContext(SearchContext);
  const { data: overview } = useQuery({ queryKey: ['stats-overview'], queryFn: getStatsOverview });

  return (
    <div style={{ padding: 'var(--s-4) var(--s-6)', height: '100%', overflowY: 'auto' }}>
      <div style={{
        display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-6)',
      }}>
        <div onClick={openSearch} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s-3)',
          padding: '14px 24px', borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
          width: '100%', maxWidth: 560, cursor: 'text',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <Search size={18} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 14, color: 'var(--fg-dim)' }}>
            搜索对话内容、标题...
          </span>
          <kbd style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 11,
            background: 'var(--bg)', border: '1px solid var(--border)',
            color: 'var(--fg-dim)', fontFamily: 'inherit',
          }}>Ctrl+K</kbd>
        </div>
      </div>

      {overview && overview.total_sessions === 0 ? (
        <div style={{
          textAlign: 'center', padding: 'var(--s-10) var(--s-4)', color: 'var(--fg-dim)',
        }}>
          <Database size={40} style={{ opacity: 0.2, marginBottom: 'var(--s-4)' }} />
          <div style={{ fontSize: 16, marginBottom: 'var(--s-1)' }}>暂无对话数据</div>
          <div style={{ fontSize: 13, opacity: 0.6 }}>开始对话后数据将在此显示</div>
        </div>
      ) : (
        <>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 var(--s-4)' }}>数据仪表盘</h1>

      <div style={{ marginBottom: 'var(--s-6)' }}>
        <OverviewPanel />
      </div>

      <div style={{ display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-4)', borderBottom: '1px solid var(--border-faint)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: 'var(--s-2) var(--s-4)', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'transparent', color: tab === t.key ? 'var(--fg)' : 'var(--fg-muted)',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 900 }}>
        {tab === 'project' && <ProjectPanel />}
        {tab === 'model' && <ModelPanel />}
        {tab === 'agent' && <AgentPanel />}
        {tab === 'timeline' && <TimelinePanel />}
        {tab === 'tool' && <ToolUsagePanel />}
      </div>
      </>
      )}
    </div>
  );
}
