import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate } from '@core/utils/date';
import { useChartTheme } from './chartTheme';

/**
 * A multi-series trend over a date axis. Each series renders as an area or a
 * line; the first defaults to a filled area so a single-series chart reads as a
 * clear volume curve.
 *
 * `series`: [{ key, label, color, type?: 'area'|'line', format? }]
 */
export default function TrendAreaChart({
  data = [],
  xKey = 'date',
  series = [],
  height = 260,
  xTickFormat = (d) => formatDate(d).slice(0, 6),
  labelFormat = (d) => formatDate(d),
}) {
  const t = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: t.axis, fontSize: 11 }}
          tickFormatter={xTickFormat}
          axisLine={{ stroke: t.grid }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: t.axis, fontSize: 11 }}
          tickFormatter={(v) => (series[0]?.format ? series[0].format(v) : v)}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={t.tooltipStyle}
          labelFormatter={labelFormat}
          formatter={(value, name) => {
            const s = series.find((x) => x.label === name || x.key === name);
            return [s?.format ? s.format(value) : value, s?.label ?? name];
          }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />}
        {series.map((s) =>
          (s.type ?? 'area') === 'area' ? (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              dot={false}
            />
          ) : (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
            />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
