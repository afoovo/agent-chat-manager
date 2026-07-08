import { useQuery } from '@tanstack/react-query';
import { getStatsOverview } from '../../lib/api';
import { fmtTokens } from '../../lib/utils';
import { MessageSquare, DollarSign, Zap, Calendar } from 'lucide-react';

export default function OverviewPanel() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['stats-overview'], queryFn: getStatsOverview });

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-4)' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 88, borderRadius: 'var(--r-lg)' }} />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{
        padding: 'var(--s-6)', textAlign: 'center', color: 'var(--fg-dim)',
        background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border-faint)',
      }}>
        数据加载失败，请确认后端服务已启动
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-4)' }}>
      <MetricCard icon={<MessageSquare size={18} />} label="活跃会话" value={data.total_sessions} color="var(--primary)" />
      <MetricCard icon={<DollarSign size={18} />} label="总成本" value={`$${data.total_cost.toFixed(2)}`} color="var(--ok)" />
      <MetricCard icon={<Zap size={18} />} label="总 Token" value={fmtTokens(data.total_tokens_input + data.total_tokens_output + data.total_tokens_reasoning)} color="var(--warn)" />
      <MetricCard
        icon={<Calendar size={18} />}
        label={`活跃 ${data.active_days} 天`}
        value={`日均 ${data.avg_daily_sessions} 次`}
        color="var(--fg-muted)"
      />
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div style={{
      padding: 'var(--s-4)', background: 'var(--surface)', borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border-faint)',
    }}>
      <div style={{ color, marginBottom: 'var(--s-2)' }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg)', marginBottom: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--fg-dim)' }}>{label}</div>
    </div>
  );
}
