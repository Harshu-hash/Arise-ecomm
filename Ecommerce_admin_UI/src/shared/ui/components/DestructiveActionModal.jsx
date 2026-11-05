import { Alert, List, Typography } from 'antd';
import ConfirmActionModal from './ConfirmActionModal';

export default function DestructiveActionModal({ affectedResources = [], ...props }) {
  const summary = (
    <div>
      <Alert type="warning" showIcon message={`${affectedResources.length} affected resource${affectedResources.length === 1 ? '' : 's'}`} />
      <List size="small" dataSource={affectedResources} renderItem={(item) => <List.Item><Typography.Text>{typeof item === 'string' ? item : `${item.label}: ${item.count ?? 1}`}</Typography.Text></List.Item>} />
    </div>
  );
  return <ConfirmActionModal {...props} danger impact={summary} />;
}
