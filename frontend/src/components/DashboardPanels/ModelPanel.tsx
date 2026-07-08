import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getStatsByModel } from '../../lib/api';
import { CHART_COLORS } from '../../lib/colors';

export default function ModelPanel() {
  const { data = [] } = useQuery({ queryKey: ['stats-by-model'], queryFn: getStatsByModel });

  const pieData = (data as any[]).map((d) => ({
    name: `${d.provider_id || '?'}/${d.model_id || '?'}`,
    value: d.session_count,
  }));

  const barData = (data as any[]).slice(0, 8).map((d) => ({
    name: (d.model_id || '?').slice(0, 12),
    avgTokens: d.avg_tokens,
    avgCost: +(d.avg_cost * 100).toFixed(1),
  }));

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 var(--s-4)' }}>模型使用分布</h3>
      <div style={{ display: 'flex', gap: 'var(--s-4)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => name.split('/')[1] || name}>
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <XAxis dataKey="name" fontSize={10} stroke="var(--fg-dim)" />
              <YAxis yAxisId="left" fontSize={10} stroke="var(--fg-dim)" />
              <YAxis yAxisId="right" orientation="right" fontSize={10} stroke="var(--fg-dim)" />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend />
              <Bar yAxisId="left" dataKey="avgTokens" name="平均 Token" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="avgCost" name="平均成本(c)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
