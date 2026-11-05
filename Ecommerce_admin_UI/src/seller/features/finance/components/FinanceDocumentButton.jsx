import { DownloadOutlined, FilePdfOutlined, RedoOutlined } from '@ant-design/icons';
import { Alert, Button, Space, Tooltip, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financeApi, financeKeys } from '../api/finance.api';

export default function FinanceDocumentButton({ kind, entityType, entityId, label = 'Generate PDF', compact = false }) {
  const queryClient = useQueryClient();
  const key = financeKeys.documents(entityType, entityId);
  const query = useQuery({ queryKey: key, queryFn: () => financeApi.documents({ entityType, entityId }), enabled: Boolean(entityId) });
  const document = query.data?.filter((row) => row.kind === kind).at(-1);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const generate = useMutation({ mutationFn: () => financeApi.generateDocument({ kind, entityType, entityId }), onSuccess: () => { message.success(`${label} is ready.`); refresh(); }, onError: (error) => message.error(error?.message ?? 'Could not generate document.') });
  const retry = useMutation({ mutationFn: () => financeApi.retryDocument(document.id), onSuccess: () => { message.success(`${label} regenerated.`); refresh(); }, onError: (error) => message.error(error?.message ?? 'Could not retry document.') });

  if (document?.status === 'READY') return <Button size={compact ? 'small' : 'middle'} icon={<DownloadOutlined />} href={document.downloadUrl} target="_blank">{compact ? 'PDF' : `Download ${label}`}</Button>;
  if (document?.status === 'FAILED') return (
    <Space direction="vertical" size={4}>
      {!compact && <Alert type="error" showIcon message={document.failureReason} />}
      <Tooltip title={document.failureReason}><Button danger size={compact ? 'small' : 'middle'} icon={<RedoOutlined />} loading={retry.isPending} onClick={() => retry.mutate()}>Retry</Button></Tooltip>
    </Space>
  );
  return <Button size={compact ? 'small' : 'middle'} icon={<FilePdfOutlined />} loading={generate.isPending || query.isLoading} onClick={() => generate.mutate()}>{label}</Button>;
}
