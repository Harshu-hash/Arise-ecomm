/* eslint-disable max-lines */
import { UploadOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Descriptions, Drawer, Flex, Form, Input, List, Modal, Row, Space, Switch, Tag, Typography, Upload } from 'antd';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DocumentUpload from '@ui/components/DocumentUpload';
import DocumentViewer from '@ui/components/DocumentViewer';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import { settingsApi, settingsKeys } from '../api/settings.api';

// Form.Item value = [{ key, url }] (at most one); one-shot multipart upload to /uploads.
function StoreLogoField({ value = [], onChange }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    setBusy(true);
    try { const { key, url } = await settingsApi.uploadLogo(file); onChange?.([{ key, url }]); }
    catch (error) { message.error(error?.message ?? 'Could not upload the logo.'); }
    finally { setBusy(false); }
    return false;
  };
  return <Space align="center">
    {value[0] && <img src={value[0].url} alt="Store logo" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />}
    <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={upload}><Button icon={<UploadOutlined />} loading={busy}>{value[0] ? 'Replace' : 'Upload logo'}</Button></Upload>
    {value[0] && <Button danger type="link" onClick={() => onChange?.([])}>Remove</Button>}
  </Space>;
}

const DOC_STATUS_COLOR = { APPROVED: 'green', PENDING: 'gold', REJECTED: 'red' };

export default function ProfilePage({ embedded = false }) {
  const { message } = App.useApp();
  const client = useQueryClient();
  const [form] = Form.useForm();
  const [changeForm] = Form.useForm();
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeEvidence, setChangeEvidence] = useState([]);
  const [preview, setPreview] = useState(null);
  const [renewing, setRenewing] = useState(null);
  const [replacement, setReplacement] = useState([]);
  const query = useQuery({ queryKey: settingsKeys.profile, queryFn: settingsApi.profile });
  const data = query.data;

  useEffect(() => {
    if (data?.seller) form.setFieldsValue({ storeName: data.seller.storeName, logo: data.seller.logoKey ? [{ key: data.seller.logoKey, url: data.seller.logoUrl }] : [] });
  }, [data, form]);

  const refresh = () => client.invalidateQueries({ queryKey: settingsKeys.profile });
  const saveMut = useMutation({ mutationFn: (values) => settingsApi.updateProfile({ storeName: values.storeName, logoKey: values.logo?.[0]?.key ?? null }), onSuccess: () => { message.success('Public store profile updated.'); refresh(); }, onError: (error) => message.error(error?.message ?? 'Could not save.') });
  const gstinMut = useMutation({ mutationFn: settingsApi.setGstin, onSuccess: () => { message.success('GSTIN saved. New invoices will carry it; ask Arise to re-generate any earlier ones.'); refresh(); }, onError: (error) => message.error(error?.message ?? 'Could not save the GSTIN.') });
  const vacationMut = useMutation({ mutationFn: settingsApi.setVacation, onSuccess: () => { message.success('Holiday mode updated.'); refresh(); } });
  const changeMut = useMutation({ mutationFn: (values) => settingsApi.requestVerifiedChange({ proposedValue: values.proposedValue, reason: values.reason, evidenceMediaIds: changeEvidence.map((item) => item.mediaId) }), onSuccess: () => { message.success('Legal-name change sent for admin review.'); setChangeOpen(false); setChangeEvidence([]); changeForm.resetFields(); refresh(); }, onError: (error) => message.error(error?.message ?? 'Could not create the change request.') });
  const renewalMut = useMutation({ mutationFn: () => settingsApi.renewDocument(renewing.id, { mediaId: replacement[0]?.mediaId }), onSuccess: () => { message.success('Replacement submitted for verification.'); setRenewing(null); setReplacement([]); refresh(); }, onError: (error) => message.error(error?.message ?? 'Could not renew the document.') });

  if (query.isLoading) return <FullPageSpinner label="Loading profile…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const { seller, documents, changeRequests = [] } = data;
  const warnings = documents.filter((document) => ['EXPIRED', 'EXPIRING_SOON'].includes(document.expiryState));

  return <Flex vertical gap={16}>
    {!embedded && <PageHeader title="Business Profile" breadcrumbs={[{ label: 'Settings' }, { label: 'Business Profile' }]} subtitle="Public storefront details are editable immediately; verified identity changes require review." />}
    {warnings.length > 0 && <Alert type={warnings.some((document) => document.expiryState === 'EXPIRED') ? 'error' : 'warning'} showIcon message="Verification documents need attention" description={warnings.map((document) => `${document.label}: ${document.expiryState === 'EXPIRED' ? 'expired' : 'expires soon'}`).join(' · ')} />}
    <Row gutter={[16, 16]}><Col xs={24} lg={14}><Card title="Public store identity" style={{ marginBottom: 16 }}><Form form={form} layout="vertical" onFinish={saveMut.mutate}><Form.Item name="storeName" label="Public store name" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="logo" label="Store logo"><StoreLogoField /></Form.Item><Button type="primary" htmlType="submit" loading={saveMut.isPending}>Save public profile</Button></Form></Card>
      <Card title="Verified legal identity" extra={<Button onClick={() => { changeForm.setFieldsValue({ proposedValue: seller.legalName }); setChangeOpen(true); }}>Request legal-name change</Button>}><Descriptions column={1} size="small"><Descriptions.Item label="Legal entity name">{seller.legalName}</Descriptions.Item><Descriptions.Item label="GSTIN"><Space wrap>{seller.gstin ?? 'Not set: your documents are bills of supply with no GST'}<Button size="small" onClick={() => { const value = window.prompt('GSTIN (15 characters); leave empty to remove', seller.gstin ?? ''); if (value !== null) gstinMut.mutate(value.trim() || null); }}>{seller.gstin ? 'Change' : 'Add GSTIN'}</Button></Space></Descriptions.Item><Descriptions.Item label="PAN">{seller.pan ?? 'Not set'}</Descriptions.Item><Descriptions.Item label="Tier">{seller.tier}</Descriptions.Item><Descriptions.Item label="Registered location">{seller.city}, {seller.state}</Descriptions.Item></Descriptions>{changeRequests.length > 0 && <List size="small" header="Change requests" dataSource={changeRequests} renderItem={(request) => <List.Item><Space direction="vertical" size={0}><Typography.Text>{request.currentValue} → {request.proposedValue}</Typography.Text><Typography.Text type="secondary">{request.reason}</Typography.Text></Space><Tag color={request.status === 'APPROVED' ? 'green' : request.status === 'REJECTED' ? 'red' : 'gold'}>{request.status}</Tag></List.Item>} />}</Card>
    </Col><Col xs={24} lg={10}><Card title="Verification documents" size="small" style={{ marginBottom: 16 }}><List size="small" dataSource={documents} locale={{ emptyText: 'No documents on file.' }} renderItem={(document) => <List.Item actions={[<Button key="preview" type="link" onClick={() => setPreview(document)}>Preview</Button>, <Button key="renew" type="link" onClick={() => { setRenewing(document); setReplacement([]); }}>Renew</Button>]}><List.Item.Meta title={document.label} description={<Space wrap><Tag color={DOC_STATUS_COLOR[document.status] ?? 'default'}>{document.status}</Tag>{document.expiryState && <Tag color={document.expiryState === 'EXPIRED' ? 'red' : document.expiryState === 'EXPIRING_SOON' ? 'gold' : 'green'}>{document.expiryState.replace('_', ' ')}</Tag>}<Typography.Text type="secondary">v{document.version}</Typography.Text></Space>} />{document.previousVersions?.length > 0 && <details><summary>{document.previousVersions.length} older version{document.previousVersions.length === 1 ? '' : 's'}</summary>{document.previousVersions.map((version) => <div key={`${version.version}-${version.uploadedAt}`}>v{version.version} · {version.fileName}</div>)}</details>}</List.Item>} /></Card><Card title="Holiday mode" size="small"><Flex wrap justify="space-between" align="center"><Typography.Text>Pause all listings</Typography.Text><Switch checked={Boolean(seller.vacationMode)} loading={vacationMut.isPending} onChange={vacationMut.mutate} /></Flex></Card></Col></Row>

    <Drawer title={preview?.label} open={Boolean(preview)} onClose={() => setPreview(null)} width="min(620px, 100vw)">{preview && <DocumentViewer document={preview} readOnly />}</Drawer>
    <Modal title={`Renew ${renewing?.label ?? 'document'}`} open={Boolean(renewing)} onCancel={() => { setRenewing(null); setReplacement([]); }} onOk={() => renewalMut.mutate()} okButtonProps={{ disabled: !replacement[0], loading: renewalMut.isPending }} okText="Submit replacement"><Alert type="info" showIcon message="The current approved version remains in history while the replacement is reviewed." style={{ marginBottom: 12 }} /><DocumentUpload value={replacement} onChange={setReplacement} maxCount={1} label="Replacement document" /></Modal>
    <Modal title="Request verified legal-name change" open={changeOpen} onCancel={() => setChangeOpen(false)} onOk={() => changeForm.submit()} confirmLoading={changeMut.isPending} okText="Send for review"><Alert type="warning" showIcon message="The verified legal name will not change until an administrator approves this request." style={{ marginBottom: 12 }} /><Form form={changeForm} layout="vertical" onFinish={changeMut.mutate}><Form.Item name="proposedValue" label="Proposed legal name" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="reason" label="Reason" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item><Form.Item label="Supporting evidence"><DocumentUpload value={changeEvidence} onChange={setChangeEvidence} maxCount={3} label="Legal-name evidence" /></Form.Item></Form></Modal>
  </Flex>;
}
