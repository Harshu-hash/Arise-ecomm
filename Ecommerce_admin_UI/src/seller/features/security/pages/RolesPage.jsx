import { App, Button, Card, Flex, Form, Input, Modal, Popconfirm, Select, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import PageHeader from '@ui/components/PageHeader';
import { SELLER_PERMISSION_MODULES } from '@seller/rbac/permissions';
import StepUpModal from '../components/StepUpModal';
import { securityApi, securityKeys } from '../api/security.api';

const OPTIONS = SELLER_PERMISSION_MODULES.flatMap((module) => module.resources.flatMap((resource) => resource.actions.map((action) => ({ value: `${module.key}.${resource.key}.${action}`, label: `${module.label} · ${resource.label} · ${action}` })))).filter((option) => !option.value.startsWith('security.'));

export default function RolesPage() {
  const { message } = App.useApp(); const client = useQueryClient(); const [open, setOpen] = useState(false); const [step, setStep] = useState(false); const [pending, setPending] = useState(null); const [form] = Form.useForm();
  const query = useQuery({ queryKey: securityKeys.roles, queryFn: securityApi.roles }); const refresh = () => client.invalidateQueries({ queryKey: securityKeys.roles });
  const remove = useMutation({ mutationFn: securityApi.deleteRole, onSuccess: refresh, onError: (error) => message.error(error?.message) });
  const submit = async () => { const values = await form.validateFields(); setPending(values); setStep(true); };
  const create = async (token) => { await securityApi.createRole(pending, token); message.success('Custom role created.'); setOpen(false); setPending(null); form.resetFields(); refresh(); };
  return <Flex vertical gap={16}><PageHeader title="Roles & permissions" breadcrumbs={[{ label: 'Settings' }, { label: 'Roles' }]} subtitle="Use safe templates or create least-privilege roles. Credential and role administration cannot be delegated through custom roles." actions={<Button type="primary" onClick={() => setOpen(true)}>New custom role</Button>} /><Card styles={{ body: { padding: 0 } }}><Table rowKey={(row) => row.id ?? row.key} dataSource={query.data ?? []} loading={query.isLoading} pagination={false} scroll={{ x: 'max-content' }} columns={[{ title: 'Role', dataIndex: 'name', render: (value, row) => <div><Typography.Text strong>{value}</Typography.Text><div><Typography.Text type="secondary">{row.description}</Typography.Text></div></div> }, { title: 'Type', render: (_value, row) => <Tag>{row.template ? 'SAFE TEMPLATE' : 'CUSTOM'}</Tag> }, { title: 'Permissions', dataIndex: 'permissions', render: (values) => values.includes('*') ? 'Full account access' : `${values.length} permissions` }, { title: '', render: (_value, row) => !row.template && <Popconfirm title="Delete this role?" onConfirm={() => remove.mutate(row.id)}><Button danger type="text">Delete</Button></Popconfirm> }]} /></Card><Modal title="Create custom role" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="Review & create" width={720}><Form form={form} layout="vertical"><Form.Item name="name" label="Role name" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="description" label="Description"><Input /></Form.Item><Form.Item name="permissions" label="Permission matrix" rules={[{ required: true, type: 'array', min: 1 }]}><Select mode="multiple" showSearch optionFilterProp="label" options={OPTIONS} maxTagCount="responsive" /></Form.Item></Form></Modal><StepUpModal open={step} onCancel={() => setStep(false)} onVerified={create} title="Confirm role creation" /></Flex>;
}
