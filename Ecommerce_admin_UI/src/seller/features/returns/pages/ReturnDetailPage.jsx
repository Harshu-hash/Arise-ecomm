import { App, Alert, Button, Card, Col, Descriptions, Flex, Image, Input, List, Modal, Radio, Row, Select, Space, Tag, Timeline, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Can } from '@core/rbac/Can';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import DocumentUpload from '@ui/components/DocumentUpload';
import { returnKeys, returnsApi } from '../api/returns.api';

export default function ReturnDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectCode, setRejectCode] = useState('POLICY_NOT_MET');
  const [rejectEvidence, setRejectEvidence] = useState([]);
  const [qcOpen, setQcOpen] = useState(false);
  const [qcResult, setQcResult] = useState('PASS');
  const [qcNotes, setQcNotes] = useState('');
  const [qcReasonCode, setQcReasonCode] = useState('USED_OR_DAMAGED');
  const [qcEvidence, setQcEvidence] = useState([]);

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: returnKeys.detail(id), queryFn: () => returnsApi.detail(id) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: returnKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: ['seller', 'returns', 'list'] });
  };

  const approveMut = useMutation({ mutationFn: () => returnsApi.approve(id), onSuccess: () => { message.success('Return approved; reverse pickup scheduled.'); invalidate(); }, onError: (e) => message.error(e?.message ?? 'Could not approve.') });
  const rejectMut = useMutation({ mutationFn: () => returnsApi.reject(id, { reasonCode: rejectCode, reason: rejectReason, evidenceMediaIds: rejectEvidence.map((item) => item.mediaId) }), onSuccess: () => { message.success('Return rejected with a durable decision record.'); setRejectOpen(false); invalidate(); }, onError: (e) => message.error(e?.message ?? 'Could not reject.') });
  const receiveMut = useMutation({ mutationFn: () => returnsApi.receive(id), onSuccess: () => { message.success('Marked as received.'); invalidate(); }, onError: (e) => message.error(e?.message ?? 'Could not update.') });
  const qcMut = useMutation({ mutationFn: () => returnsApi.qc(id, { result: qcResult, reasonCode: qcResult === 'FAIL' ? qcReasonCode : null, notes: qcNotes, evidenceMediaIds: qcEvidence.map((item) => item.mediaId) }), onSuccess: () => { message.success('QC recorded.'); setQcOpen(false); invalidate(); }, onError: (e) => message.error(e?.message ?? 'Could not record QC.') });

  if (isLoading) return <FullPageSpinner label="Loading return…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const actions = data.actions ?? [];
  const isArise = data.fulfillmentType === 'ARISE';

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={`Return ${data.id}`}
        breadcrumbs={[{ label: 'Returns', to: '/returns' }, { label: data.id }]}
        onBack={() => navigate('/returns')}
        tags={<Space><StatusTag domain="returnRequest" code={data.status} />{isArise && <Tag color="geekblue">By Arise</Tag>}</Space>}
        actions={
          <Space>
            {actions.includes('reject') && <Can perm="orders.return.manage"><Button danger onClick={() => setRejectOpen(true)}>Reject</Button></Can>}
            {actions.includes('approve') && <Can perm="orders.return.manage"><Button type="primary" loading={approveMut.isPending} onClick={() => approveMut.mutate()}>Approve & schedule pickup</Button></Can>}
            {actions.includes('receive') && <Can perm="orders.return.manage"><Button type="primary" loading={receiveMut.isPending} onClick={() => receiveMut.mutate()}>Mark received</Button></Can>}
            {actions.includes('qc') && <Can perm="orders.return.manage"><Button type="primary" onClick={() => setQcOpen(true)}>Record QC</Button></Can>}
            {['RETURN_REJECTED', 'QC_FAILED', 'CLOSED'].includes(data.status) && <Button onClick={() => navigate(`/returns/${id}/dispute`)}>Dispute</Button>}
          </Space>
        }
      />

      {isArise && <Alert type="info" showIcon message="Fulfilled by Arise" description="Arise handles the reverse pickup and QC for this return." />}
      {data.overrideReason && <Alert type="warning" showIcon message="Seller rejection overridden by admin" description={`${data.overrideReason}${data.overriddenByName ? ` — ${data.overriddenByName}` : ''}`} />}
      {data.policy?.decisionOverdue && <Alert type="error" showIcon message="Decision SLA breached" description={`A decision was due by ${new Date(data.policy.decisionDueAt).toLocaleString()}.`} />}

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="Return details" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Product">{data.productName}</Descriptions.Item>
              <Descriptions.Item label="Variant">{data.variantLabel ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Order">{data.orderId}</Descriptions.Item>
              <Descriptions.Item label="Type">{data.type}</Descriptions.Item>
              <Descriptions.Item label="Reason">{data.reason}</Descriptions.Item>
              <Descriptions.Item label="Refund value"><MoneyText paise={data.amountPaise} strong /></Descriptions.Item>
              <Descriptions.Item label="Requested"><DateText value={data.requestedAt} /></Descriptions.Item>
              <Descriptions.Item label="Decision due"><DateText value={data.policy?.decisionDueAt} withTime /></Descriptions.Item>
              <Descriptions.Item label="Eligibility">{data.policy?.explanation}</Descriptions.Item>
              {data.pickupAwb && <Descriptions.Item label="Reverse AWB">{data.pickupAwb}</Descriptions.Item>}
              {data.reverseCourierName && <Descriptions.Item label="Reverse courier">{data.reverseCourierName}</Descriptions.Item>}
              {data.reverseShipment?.package && <Descriptions.Item label="Return package">{data.reverseShipment.package.quantity} × {data.reverseShipment.package.contents}</Descriptions.Item>}
            </Descriptions>
            {data.comments && (
              <>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 4 }}>Customer comments</Typography.Paragraph>
                <Typography.Paragraph>{data.comments}</Typography.Paragraph>
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Customer evidence" size="small">
            {data.customerEvidence?.length ? (
              <Image.PreviewGroup>
                <Space wrap>
                  {data.customerEvidence.map((item) => <Image key={item.id} width={88} height={88} src={item.url} alt={item.fileName} fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='88'%3E%3Crect width='88' height='88' fill='%23f0f0f0'/%3E%3C/svg%3E" style={{ objectFit: 'cover', borderRadius: 6 }} />)}
                </Space>
              </Image.PreviewGroup>
            ) : <Typography.Text type="secondary">No photos attached.</Typography.Text>}
            {data.qcResult && (
              <Alert style={{ marginTop: 12 }} type={data.qcResult === 'PASS' ? 'success' : 'error'} showIcon message={`QC ${data.qcResult}`} description={data.qcNotes ?? undefined} />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={14}><Card title="Shared return timeline" size="small"><Timeline items={(data.timeline ?? []).map((event) => ({ children: <><Typography.Text strong>{event.type.replace(/_/g, ' ')}</Typography.Text><div><Typography.Text type="secondary">{event.actorName} · <DateText value={event.at} withTime /></Typography.Text></div>{event.reason && <div>{event.reason}</div>}</> }))} /></Card></Col>
        <Col xs={24} lg={10}><Card title="Outcome and linked records" size="small"><List dataSource={[data.refund && { id: data.refund.id, label: `Refund ${data.refund.id}`, status: data.refund.status }, data.replacement && { id: data.replacement.id, label: `Replacement ${data.replacement.id}`, status: data.replacement.status, extra: data.replacement.fulfilmentId }, ...(data.disputes ?? []).map((item) => ({ id: item.id, label: `Dispute ${item.id}`, status: item.status }))].filter(Boolean)} locale={{ emptyText: 'No refund, replacement or dispute yet.' }} renderItem={(item) => <List.Item><List.Item.Meta title={item.label} description={item.extra ? `Fulfilment ${item.extra}` : undefined} /><Tag>{item.status}</Tag></List.Item>} /></Card></Col>
      </Row>

      <Modal title="Reject this return?" open={rejectOpen} onCancel={() => setRejectOpen(false)} onOk={() => rejectMut.mutate()} okText="Reject return" okButtonProps={{ danger: true, disabled: !rejectReason.trim() }} confirmLoading={rejectMut.isPending}>
        <Space direction="vertical" style={{ width: '100%' }}><Select value={rejectCode} onChange={setRejectCode} options={[{ value: 'POLICY_NOT_MET', label: 'Policy conditions not met' }, { value: 'EVIDENCE_INSUFFICIENT', label: 'Evidence is insufficient' }, { value: 'WINDOW_EXPIRED', label: 'Return window expired' }, { value: 'OTHER', label: 'Other' }]} /><Input.TextArea rows={3} placeholder="Reason shared with customer and admin" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /><DocumentUpload value={rejectEvidence} onChange={setRejectEvidence} maxCount={4} label="Seller decision evidence" /></Space>
      </Modal>

      <Modal title="Record QC result" open={qcOpen} onCancel={() => setQcOpen(false)} onOk={() => qcMut.mutate()} okText="Submit QC" confirmLoading={qcMut.isPending}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Radio.Group value={qcResult} onChange={(e) => setQcResult(e.target.value)}>
            <Radio.Button value="PASS">Pass — refund the customer</Radio.Button>
            <Radio.Button value="FAIL">Fail — item not returnable</Radio.Button>
          </Radio.Group>
          <Input.TextArea rows={3} placeholder="QC notes" value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} />
          {qcResult === 'FAIL' && <><Select value={qcReasonCode} onChange={setQcReasonCode} options={[{ value: 'USED_OR_DAMAGED', label: 'Used or damaged' }, { value: 'MISSING_ACCESSORIES', label: 'Missing accessories' }, { value: 'WRONG_ITEM', label: 'Wrong item returned' }, { value: 'SERIAL_MISMATCH', label: 'Serial mismatch' }]} /><DocumentUpload value={qcEvidence} onChange={setQcEvidence} maxCount={5} label="QC evidence" /></>}
        </Space>
      </Modal>
    </Flex>
  );
}
