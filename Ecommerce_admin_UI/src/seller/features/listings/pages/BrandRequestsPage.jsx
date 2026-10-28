import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { listingKeys, listingsApi } from '../api/listings.api';

const STATUS_COLOR = { PENDING: 'gold', UNDER_REVIEW: 'blue', APPROVED: 'green', REJECTED: 'red' };

export default function BrandRequestsPage() {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const state = useUrlTableState({ defaultSort: '-submittedAt' });

  const { data: brands = [] } = useQuery({ queryKey: listingKeys.brands, queryFn: listingsApi.brands });
  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: listingKeys.brandRequests(state.queryParams),
    url: '/brand-requests',
    params: state.queryParams,
  });

  const submit = async (values) => {
    setSubmitting(true);
    try {
      await listingsApi.createBrandRequest({
        brandId: values.brandId ?? null,
        brandName: values.brandName,
        requestType: values.brandId ? 'AUTHORISATION' : 'NEW_BRAND',
        note: values.note,
      });
      message.success('Brand request submitted.');
      setOpen(false);
      form.resetFields();
      refetch();
    } catch (e) {
      message.error(e?.message ?? 'Could not submit the request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Brand & category requests"
        breadcrumbs={[{ label: 'Listings' }, { label: 'Requests' }]}
        subtitle="Request authorisation to sell a gated brand, or ask for a new brand to be added."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            New request
          </Button>
        }
      />

      <DataTable
        tableId="seller-brand-requests"
        columns={[
          { key: 'brandName', title: 'Brand', dataIndex: 'brandName', priority: 1, render: (v, r) => <Space><Typography.Text strong>{v}</Typography.Text>{r.brandId ? null : <Tag>New brand</Tag>}</Space> },
          { key: 'requestType', title: 'Type', dataIndex: 'requestType', priority: 2, render: (v) => <Tag>{v}</Tag> },
          { key: 'submittedAt', title: 'Submitted', dataIndex: 'submittedAt', priority: 2, sorter: true, render: (v) => <DateText value={v} /> },
          { key: 'status', title: 'Status', dataIndex: 'status', priority: 1, render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag> },
          { key: 'decisionReason', title: 'Note', dataIndex: 'decisionReason', priority: 3, ellipsis: true, render: (v) => v ?? '—' },
        ]}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No brand requests yet', description: 'Request authorisation for a gated brand, or ask for a new one to be added.' }}
        mobileCard={(row) => (
          <Flex vertical gap={6}>
            <Flex justify="space-between" align="flex-start" gap={8}>
              <Space><Typography.Text strong>{row.brandName}</Typography.Text>{!row.brandId && <Tag>New brand</Tag>}</Space>
              <Tag color={STATUS_COLOR[row.status] ?? 'default'}>{row.status}</Tag>
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.requestType}</Typography.Text>
          </Flex>
        )}
      />

      <Modal title="Request a brand" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} okText="Submit request" confirmLoading={submitting}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="brandId" label="Existing brand" extra="Pick a brand to request authorisation, or leave blank to request a new brand.">
            <Select
              showSearch
              allowClear
              placeholder="Search brands"
              optionFilterProp="label"
              options={brands.map((b) => ({ value: b.id, label: b.gated ? `${b.name} (gated)` : b.name }))}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.brandId !== cur.brandId}
          >
            {({ getFieldValue }) =>
              !getFieldValue('brandId') && (
                <Form.Item name="brandName" label="New brand name" rules={[{ required: true, message: 'Enter the brand name.' }]}>
                  <Input placeholder="Brand to add" />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={3} placeholder="Anything the catalog team should know" />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
