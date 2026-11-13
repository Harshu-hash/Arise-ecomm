import { Flex, Typography } from 'antd';
import { formatNumber, formatPercent } from '@core/utils/money';

/**
 * A conversion funnel: each stage as a bar relative to the top of the funnel,
 * annotated with its share of the first stage and the step-over-step drop.
 *
 * `stages`: [{ label, value }].
 */
export default function FunnelChart({ stages = [], color = 'var(--ant-color-primary)' }) {
  const top = stages[0]?.value || 0;

  return (
    <Flex vertical gap={14}>
      {stages.map((stage, i) => {
        const ofTop = top ? ((stage.value ?? 0) / top) * 100 : 0;
        const prev = stages[i - 1]?.value;
        const stepPct = prev ? ((stage.value ?? 0) / prev) * 100 : null;
        return (
          <div key={stage.label ?? i}>
            <Flex justify="space-between" align="baseline" style={{ marginBottom: 4 }}>
              <Typography.Text style={{ fontSize: 13 }}>{stage.label}</Typography.Text>
              <Flex gap={8} align="baseline">
                <Typography.Text strong className="tabular" style={{ fontSize: 13 }}>
                  {formatNumber(stage.value ?? 0)}
                </Typography.Text>
                <Typography.Text type="secondary" className="tabular" style={{ fontSize: 11, width: 48, textAlign: 'right' }}>
                  {formatPercent(ofTop, 0)}
                </Typography.Text>
              </Flex>
            </Flex>
            <div style={{ height: 22, borderRadius: 5, background: 'var(--ant-color-fill-quaternary)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(ofTop, 1.5)}%`,
                  height: '100%',
                  borderRadius: 5,
                  background: color,
                  opacity: 1 - i * 0.12,
                  transition: 'width .3s ease',
                }}
              />
            </div>
            {stepPct !== null && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {formatPercent(stepPct, 1)} from previous step
              </Typography.Text>
            )}
          </div>
        );
      })}
    </Flex>
  );
}
