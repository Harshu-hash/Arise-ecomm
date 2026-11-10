import { App, Alert, Button, Card, Flex, Form, Input, InputNumber, Select } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import DocumentUpload from '@ui/components/DocumentUpload';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import { returnKeys, returnsApi } from '../api/returns.api';

export default function ReturnDisputePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [evidence, setEvidence] = useState([]);
  const query = useQuery({ queryKey: returnKeys.detail(id), queryFn: () => returnsApi.detail(id) });
  const mutation = useMutation({
    mutationFn: (values) => returnsApi.createDispute(id, { ...values, amountClaimedPaise: Math.round(Number(values.amountClaimed) * 100), evidenceMediaIds: evidence.map((item) => item.mediaId) }),
    onSuccess: () => { message.success('Return dispute submitted.'); navigate(`/returns/${id}`); },
    onError: (error) => message.error(error?.message ?? 'Could not submit dispute.'),
  });
  if (query.isLoading) return <FullPageSpinner label="Loading return…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  return <Flex vertical gap={16}>
    <PageHeader title={`Dispute return ${id}`} breadcrumbs={[{ label: 'Returns', to: '/returns' }, { label: id, to: `/returns/${id}` }, { label: 'Dispute' }]} onBack={() => navigate(`/returns/${id}`)} subtitle="Keep the return decision separate from your reimbursement claim and attach durable evidence." />
    <Alert type="info" showIcon message={`Current return status: ${query.data.status}`} description="The dispute is reviewed independently and does not silently change the customer refund or replacement." />
    <Card><Form layout="vertical" onFinish={(values) => mutation.mutate(values)} initialValues={{ reasonCode: 'RETURN_DAMAGED', amountClaimed: query.data.amountPaise / 100 }}>
      <Form.Item name="reasonCode" label="Dispute reason" rules={[{ required: true }]}><Select options={[{ value: 'RETURN_DAMAGED', label: 'Returned damaged or used' }, { value: 'WRONG_ITEM_RETURNED', label: 'Different item returned' }, { value: 'QC_INCORRECT', label: 'QC result is incorrect' }, { value: 'OTHER', label: 'Other' }]} /></Form.Item>
      <Form.Item name="reason" label="What does the evidence prove?" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
      <Form.Item name="amountClaimed" label="Amount claimed (₹)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
      <Form.Item label="Evidence" required><DocumentUpload value={evidence} onChange={setEvidence} maxCount={5} label="Return dispute evidence" /></Form.Item>
      <Button type="primary" htmlType="submit" loading={mutation.isPending} disabled={!evidence.length}>Submit dispute</Button>
    </Form></Card>
  </Flex>;
}
