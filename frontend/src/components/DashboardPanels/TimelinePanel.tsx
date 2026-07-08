import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getStatsTokenTrend, getStatsHeatmap } from '../../lib/api';
import { fmtTokens } from '../../lib/utils';

export default function TimelinePanel() {
  const year = new Date().getFullYear();
  const [selectedYear] = useState(year);

  const { data: trend = [] } = useQuery({
    queryKey: ['stats-token-trend', 'day'],
    queryFn: () => getStatsTokenTrend('day'),
  });

  const { data: heatmap = [] } = useQuery({
    queryKey: ['stats-heatmap', selectedYear],
    queryFn: () => getStatsHeatmap(selectedYear),
  });

  const heatmapMap = new Map((heatmap as any[]).map((h: any) => [h.date_label, h.sessions]));

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 var(--s-4)' }}>Token 消耗趋势 & 活跃热力图</h3>

      <div style={{ marginBottom: 'var(--s-6)' }}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={(trend as any[]).slice(-60)}>
            <XAxis dataKey="date_label" fontSize={10} stroke="var(--fg-dim)"
              tickFormatter={(v: string) => v.slice(5)} />
            <YAxis fontSize={10} stroke="var(--fg-dim)" tickFormatter={fmtTokens} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="tokens_input" name="输入" stroke="#8b5cf6" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="tokens_output" name="输出" stroke="#22c55e" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(53, 1fr)', gap: 3,
        maxWidth: 800, margin: '0 auto',
      }}>
        {Array.from({ length: 53 * 7 }).map((_, cellIdx) => {
          const week = Math.floor(cellIdx / 7);
          const dayOfWeek = cellIdx % 7;

          const startOfYear = new Date(selectedYear, 0, 1);
          const startDay = startOfYear.getDay();
          const dayOfYear = week * 7 + dayOfWeek - startDay + 1;

          const d = new Date(selectedYear, 0, dayOfYear);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const count = heatmapMap.get(key) || 0;

          const opacity = count === 0 ? 0.08 : Math.min(0.25 + count * 0.05, 1);
          const valid = dayOfYear >= 1 && d.getFullYear() === selectedYear;

          return (
            <div
              key={cellIdx}
              title={valid ? `${key}: ${count} 次` : ''}
              style={{
                width: '100%', aspectRatio: '1',
                background: valid ? `oklch(62% 0.18 250 / ${opacity})` : 'transparent',
                borderRadius: 3,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
