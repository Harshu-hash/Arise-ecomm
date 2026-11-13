import { Flex, Typography } from 'antd';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { colorAt, useChartTheme } from './chartTheme';

/**
 * A donut with a compact legend that doubles as a value table — share of mix
 * questions (payment methods, channels, ticket channels) answered at a glance.
 *
 * `data`: [{ label, value }]. `format` renders each value in the legend/tooltip.
 */
export default function DonutChart({ data = [], format = (v) => v, height = 220 }) {
  const t = useChartTheme();
  const total = data.reduce((n, d) => n + (d.value ?? 0), 0);
  const rows = data.filter((d) => (d.value ?? 0) > 0);

  return (
    <Flex gap={16} align="center" wrap>
      <div style={{ width: height, height, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              paddingAngle={rows.length > 1 ? 2 : 0}
              stroke="none"
            >
              {rows.map((row, i) => (
                <Cell key={row.label ?? i} fill={colorAt(i)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={t.tooltipStyle}
              formatter={(value, name) => [format(value), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <Flex vertical gap={8} style={{ flex: 1, minWidth: 160 }}>
        {rows.map((row, i) => {
          const pct = total ? ((row.value ?? 0) / total) * 100 : 0;
          return (
            <Flex key={row.label ?? i} justify="space-between" align="center" gap={8}>
              <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: colorAt(i), flexShrink: 0 }} />
                <Typography.Text style={{ fontSize: 13 }} ellipsis={{ tooltip: row.label }}>
                  {row.label}
                </Typography.Text>
              </Flex>
              <Flex gap={8} align="baseline" style={{ flexShrink: 0 }}>
                <Typography.Text strong className="tabular" style={{ fontSize: 13 }}>
                  {format(row.value)}
                </Typography.Text>
                <Typography.Text type="secondary" className="tabular" style={{ fontSize: 11, width: 42, textAlign: 'right' }}>
                  {pct.toFixed(1)}%
                </Typography.Text>
              </Flex>
            </Flex>
          );
        })}
      </Flex>
    </Flex>
  );
}
