import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getStatsByAgent } from '../../lib/api';
import { AGENT_COLORS as COLORS } from '../../lib/colors';

function agentLabel(a: string) { return a || '未知'; }

export default function AgentPanel() {
  const { data = [] } = useQuery({ queryKey: ['stats-by-agent'], queryFn: getStatsByAgent });

  const pieData = (data as any[]).map((d) => ({
    name: agentLabel(d.agent),
    value: d.session_count,
  }));

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 var(--s-4)' }}>Agent 类型分布</h3>
      <div style={{ display: 'flex', gap: 'var(--s-4)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                {pieData.map((d, i) => (
                  <Cell key={i} fill={COLORS[d.name] || '#64748b'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={(data as any[])} layout="vertical">
              <XAxis type="number" fontSize={11} stroke="var(--fg-dim)" />
              <YAxis type="category" dataKey="agent" fontSize={11} stroke="var(--fg-dim)" width={50}
                tickFormatter={(v: string) => agentLabel(v)} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="avg_cost" name="平均成本" fill="#f97316" radius={[0, 4, 4, 0]}>
                {(data as any[]).map((d, i) => (
                  <Cell key={i} fill={COLORS[d.agent] || '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
