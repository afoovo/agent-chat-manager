import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getStatsByProject } from '../../lib/api';
import { CHART_COLORS } from '../../lib/colors';

export default function ProjectPanel() {
  const { data = [] } = useQuery({ queryKey: ['stats-by-project'], queryFn: getStatsByProject });

  const items = (data as any[]).slice(0, 10);

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 var(--s-4)' }}>项目会话分布</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={items} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 100 }}>
          <XAxis type="number" fontSize={11} stroke="var(--fg-dim)" />
          <YAxis type="category" dataKey="worktree" fontSize={11} stroke="var(--fg-dim)" width={90}
            tickFormatter={(v: string) => (v || '/').split(/[/\\]/).pop() || '/'} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="session_count" name="会话数" radius={[0, 4, 4, 0]}>
            {items.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
