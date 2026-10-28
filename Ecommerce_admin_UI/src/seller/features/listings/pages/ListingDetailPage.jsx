import { CheckCircleTwoTone, CloseCircleTwoTone, EditOutlined, ExclamationCircleTwoTone, RedoOutlined, SendOutlined } from '@ant-design/icons';
import { App, Avatar, Alert, Button, Card, Col, Descriptions, Flex, Form, List, Row, Space, Statistic, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Can } from '@core/rbac/Can';
import { paiseToRupees, rupeesToPaise } from '@core/utils/money';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { listingKeys, listingsApi } from '../api/listings.api';
import EditListingModal from '../components/EditListingModal';
import QuickEdit from '../components/QuickEdit';

const CHECK_ICON = {
  PASS: <CheckCircleTwoTone twoToneColor="#26A541" />,
  WARN: <ExclamationCircleTwoTone twoToneColor="#FFA41C" />,
  FAIL: <CloseCircleTwoTone twoToneColor="#FF4D4F" />,
};

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editImages, setEditImages] = useState([]);
  const [editForm] = Form.useForm();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: listingKeys.detail(id),
    queryFn: () => listingsApi.detail(id),
  });

  const { data: catAttrs } = useQuery({
    queryKey: ['seller', 'catalog', 'attributes', data?.product?.categoryId],
    queryFn: () => listingsApi.categoryAttributes(data.product.categoryId),
    enabled: Boolean(data?.product?.categoryId),
  });
  const sizeCharts = catAttrs?.sizeCharts ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: ['seller', 'listings', 'list'] });
  };

  const priceMut = useMutation({
    mutationFn: (rupees) => listingsApi.setPrice(id, rupeesToPaise(rupees)),
    onSuccess: () => { message.success('Price updated.'); invalidate(); },
    onError: (e) => message.error(e?.fieldErrors?.sellingPricePaise ?? e?.message ?? 'Could not update price.'),
  });
  const stockMut = useMutation({
    mutationFn: (stock) => listingsApi.setStock(id, stock),
    onSuccess: () => { message.success('Stock updated.'); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not update stock.'),
  });
  const resubmitMut = useMutation({
    mutationFn: () => listingsApi.resubmit(id),
    onSuccess: () => { message.success('Resubmitted for QC review.'); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not resubmit.'),
  });
  const editMut = useMutation({
    mutationFn: (values) => listingsApi.update(id, {
      title: values.title,
      description: values.description,
      highlights: (values.highlights ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
      images: editImages,
      sizeChartId: values.sizeChartId ?? null,
      returnPolicy: { windowDays: values.returnWindowDays ?? 7, type: values.returnType ?? 'RETURN' },
    }),
    onSuccess: () => { message.success('Listing updated.'); setEditOpen(false); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not save.'),
  });
  const submitDraftMut = useMutation({
    mutationFn: () => listingsApi.update(id, { submitForQc: true }),
    onSuccess: () => { message.success('Submitted for QC review.'); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not submit.'),
  });

  if (isLoading) return <FullPageSpinner label="Loading listing…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const { product, variant, submission } = data;

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={data.productTitle}
        breadcrumbs={[{ label: 'Listings', to: '/listings' }, { label: data.productTitle }]}
        onBack={() => navigate('/listings')}
        tags={<StatusTag domain="listing" code={data.status} />}
        actions={
          <Space>
            {data.status === 'DRAFT' && (
              <Can perm="listings.product.edit">
                <Button type="primary" icon={<SendOutlined />} loading={submitDraftMut.isPending} onClick={() => submitDraftMut.mutate()}>
                  Submit for QC
                </Button>
              </Can>
            )}
            {data.needsChanges && (
              <Can perm="listings.product.edit">
                <Button type="primary" icon={<RedoOutlined />} loading={resubmitMut.isPending} onClick={() => resubmitMut.mutate()}>
                  Resubmit for QC
                </Button>
              </Can>
            )}
            <Can perm="listings.product.edit">
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  editForm.setFieldsValue({
                    title: product.title,
                    description: product.description,
                    highlights: (product.highlights ?? []).join('\n'),
                    sizeChartId: product.sizeChartId ?? undefined,
                    returnType: product.returnPolicy?.type ?? 'RETURN',
                    returnWindowDays: product.returnPolicy?.windowDays ?? 7,
                  });
                  setEditImages(product.images ?? []);
                  setEditOpen(true);
                }}
              >
                Edit content
              </Button>
            </Can>
          </Space>
        }
      />

      {submission?.status === 'NEEDS_CHANGES' && (
        <Alert
          type="warning"
          showIcon
          message="QC has requested changes"
          description={
            submission.issues?.length ? (
              <ul style={{ margin: '4px 0 0 16px' }}>
                {submission.issues.map((iss, i) => (
                  <li key={i}>{typeof iss === 'string' ? iss : iss.message ?? iss.detail}</li>
                ))}
              </ul>
            ) : (
              'Review the automated checks below, make the changes, then resubmit.'
            )
          }
        />
      )}
      {submission?.status === 'QC_PENDING' && (
        <Alert type="info" showIcon message="In QC review" description={`Submitted ${submission.ageHours ?? 0}h ago. Most listings are reviewed within 24 hours.`} />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Product" style={{ marginBottom: 16 }}>
            <Flex gap={16} wrap>
              <Avatar shape="square" size={96} src={data.productImage} style={{ background: '#f0f0f0' }}>
                {data.productTitle?.[0]}
              </Avatar>
              <div style={{ flex: 1, minWidth: 220 }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Brand">{data.brandName ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Category">{data.categoryPath}</Descriptions.Item>
                  <Descriptions.Item label="Variant">{data.variantLabel ?? 'Default'}</Descriptions.Item>
                  <Descriptions.Item label="SKU">{variant?.sku}</Descriptions.Item>
                  <Descriptions.Item label="HSN">{product?.hsnCode ?? '—'}</Descriptions.Item>
                </Descriptions>
              </div>
            </Flex>
            {product?.description && (
              <>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 4 }}>Description</Typography.Paragraph>
                <Typography.Paragraph>{product.description}</Typography.Paragraph>
              </>
            )}
          </Card>

          {submission?.autoChecks?.length > 0 && (
            <Card title="QC auto-checks" size="small">
              <List
                dataSource={submission.autoChecks}
                renderItem={(c) => (
                  <List.Item>
                    <List.Item.Meta avatar={CHECK_ICON[c.result]} title={c.label} description={c.detail ?? undefined} />
                    <Tag color={c.result === 'PASS' ? 'green' : c.result === 'WARN' ? 'gold' : 'red'}>{c.result}</Tag>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Price & stock" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Flex justify="space-between" align="center">
                <Statistic title="Selling price" valueRender={() => <MoneyText paise={data.sellingPricePaise} strong />} />
                <Statistic title="MRP" valueRender={() => <MoneyText paise={data.mrpPaise} type="secondary" />} />
              </Flex>
              <Can perm="listings.price.edit">
                <QuickEdit
                  label="Update price (₹)"
                  initial={paiseToRupees(data.sellingPricePaise)}
                  max={paiseToRupees(data.mrpPaise)}
                  loading={priceMut.isPending}
                  onSave={(v) => priceMut.mutate(v)}
                />
              </Can>
              <Can perm="listings.stock.edit">
                <QuickEdit label="Update stock" initial={data.stock} loading={stockMut.isPending} integer onSave={(v) => stockMut.mutate(v)} />
              </Can>
            </Space>
          </Card>

          <Card title="On this listing" size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Flex justify="space-between">
                <Typography.Text type="secondary">Buy box</Typography.Text>
                <Typography.Text strong>{data.buyBoxWinner ? 'Winning' : 'Not winning'}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text type="secondary">Other sellers on this variant</Typography.Text>
                <Typography.Text strong>{data.competingOffers}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text type="secondary">Fulfilment</Typography.Text>
                <Tag color={data.fulfillmentType === 'ARISE' ? 'geekblue' : 'default'} style={{ margin: 0 }}>
                  {data.fulfillmentType === 'ARISE' ? 'By Arise' : 'Self-ship'}
                </Tag>
              </Flex>
            </Space>
          </Card>
        </Col>
      </Row>

      <EditListingModal
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        form={editForm}
        onFinish={(v) => editMut.mutate(v)}
        loading={editMut.isPending}
        images={editImages}
        onImagesChange={setEditImages}
        sizeCharts={sizeCharts}
        isLive={data.status === 'LIVE'}
      />
    </Flex>
  );
}
