import { Alert, Typography } from 'antd';
import { IS_MOCK } from '@core/config/env';

export default function DevCodeHint({ code }) {
  if (!IS_MOCK || !code) return null;
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message="Mock environment"
      description={
        <Typography.Text>
          There is no real authenticator here. Use code{' '}
          <Typography.Text strong copyable code>{code}</Typography.Text>
        </Typography.Text>
      }
    />
  );
}

