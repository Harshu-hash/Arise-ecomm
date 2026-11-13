import { Flex, Typography } from 'antd';
import { colorAt } from './chartTheme';

/**
 * A ranked list of horizontal bars — the clearest way to compare a handful of
 * named categories (top cities, return reasons, categories by GMV). Pure CSS,
 * so it stays crisp at any width and needs no chart library.
 *
 * `data`: [{ label, value, secondary? }]. `format` renders the primary value.
 */
export default function BarListChart({
  data = [],
  format = (v) => v,
  color,
  colorful = false,
  secondaryFormat,
}) {
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));

  return (
    <Flex vertical gap={12}>
      {data.map((row, i) => {
        const pct = ((row.value ?? 0) / max) * 100;
        const barColor = colorful ? colorAt(i) : color ?? 'var(--ant-color-primary)';
        return (
          <div key={row.label ?? i}>
            <Flex justify="space-between" align="center" gap={8} style={{ marginBottom: 5 }}>
              <Typography.Text style={{ fontSize: 13 }} ellipsis={{ tooltip: row.label }}>
                {row.label}
              </Typography.Text>
              <Flex gap={8} align="baseline" style={{ flexShrink: 0 }}>
                {row.secondary !== undefined && (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }} className="tabular">
                    {secondaryFormat ? secondaryFormat(row.secondary) : row.secondary}
                  </Typography.Text>
                )}
                <Typography.Text strong className="tabular" style={{ fontSize: 13 }}>
                  {format(row.value)}
                </Typography.Text>
              </Flex>
            </Flex>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--ant-color-fill-quaternary)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: barColor, transition: 'width .3s ease' }} />
            </div>
          </div>
        );
      })}
    </Flex>
  );
}
