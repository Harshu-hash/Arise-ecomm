/* eslint-disable max-lines */
import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  EditOutlined,
  ExclamationCircleTwoTone,
  RedoOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  App,
  Avatar,
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { paiseToRupees, rupeesToPaise } from '@core/utils/money';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import MoneyText from '@ui/components/MoneyText';
import ImageUpload from '@ui/components/ImageUpload/ImageUpload';
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
  const [lifecycleAction, setLifecycleAction] = useState(null);
  const [reason, setReason] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [variantImages, setVariantImages] = useState([]);
  const [scheduleForm] = Form.useForm();
  const [variantForm] = Form.useForm();

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

  const { data: feePreview } = useQuery({
    queryKey: ['seller', 'listings', id, 'fee-preview', data?.sellingPricePaise],
    queryFn: () =>
      listingsApi.feePreview({
        pricePaise: data.sellingPricePaise,
        categoryId: data.product.categoryId,
        variantId: data.variantId,
      }),
    enabled: Boolean(data?.sellingPricePaise && data?.product?.categoryId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: ['seller', 'listings', 'list'] });
  };

  const priceMut = useMutation({
    mutationFn: (rupees) => listingsApi.setPrice(id, rupeesToPaise(rupees)),
    onSuccess: () => {
      message.success('Price updated.');
      invalidate();
    },
    onError: (e) =>
      message.error(e?.fieldErrors?.sellingPricePaise ?? e?.message ?? 'Could not update price.'),
  });
  const stockMut = useMutation({
    mutationFn: (stock) => listingsApi.setStock(id, stock),
    onSuccess: () => {
      message.success('Stock updated.');
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not update stock.'),
  });
  const resubmitMut = useMutation({
    mutationFn: () => listingsApi.resubmit(id),
    onSuccess: () => {
      message.success('Resubmitted for QC review.');
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not resubmit.'),
  });
  const editMut = useMutation({
    mutationFn: (values) =>
      listingsApi.update(id, {
        title: values.title,
        description: values.description,
        highlights: (values.highlights ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        images: editImages,
        sizeChartId: values.sizeChartId ?? null,
        returnPolicy: {
          windowDays: values.returnWindowDays ?? 7,
          type: values.returnType ?? 'RETURN',
        },
      }),
    onSuccess: () => {
      message.success('Listing updated.');
      setEditOpen(false);
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not save.'),
  });
  const submitDraftMut = useMutation({
    mutationFn: () => listingsApi.update(id, { submitForQc: true }),
    onSuccess: () => {
      message.success('Submitted for QC review.');
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not submit.'),
  });
  const lifecycleMut = useMutation({
    mutationFn: () => listingsApi.lifecycle(id, lifecycleAction, { reason }),
    onSuccess: () => {
      message.success(`Listing ${lifecycleAction} completed.`);
      setLifecycleAction(null);
      setReason('');
      invalidate();
    },
    onError: (e) =>
      message.error(e?.fieldErrors?.reason ?? e?.message ?? 'Could not update the listing.'),
  });
  const scheduleMut = useMutation({
    mutationFn: (values) =>
      listingsApi.setPrice(id, {
        sellingPricePaise: rupeesToPaise(values.price),
        mrpPaise: rupeesToPaise(values.mrp),
        scheduledAt: values.scheduledAt.toISOString(),
      }),
    onSuccess: () => {
      message.success('Price change scheduled.');
      setScheduleOpen(false);
      scheduleForm.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not schedule the price.'),
  });
  const variantMut = useMutation({
    mutationFn: (values) =>
      listingsApi.updateVariant(id, {
        ...values,
        images: variantImages,
        dimsCm: { l: values.dimsL, w: values.dimsW, h: values.dimsH },
      }),
    onSuccess: () => {
      message.success('Variant details updated.');
      setVariantOpen(false);
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not update the variant.'),
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
              <>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={submitDraftMut.isPending}
                  onClick={() => submitDraftMut.mutate()}
                >
                  Submit for QC
                </Button>
              </>
            )}
            {data.needsChanges && (
              <>
                <Button
                  type="primary"
                  icon={<RedoOutlined />}
                  loading={resubmitMut.isPending}
                  onClick={() => resubmitMut.mutate()}
                >
                  Resubmit for QC
                </Button>
              </>
            )}
            <>
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
            </>
            {data.productStatus === 'LIVE' && data.status === 'LIVE' && (
              <Button danger onClick={() => setLifecycleAction('deactivate')}>
                Deactivate offer
              </Button>
            )}
            {data.productStatus === 'LIVE' && ['INACTIVE', 'ARCHIVED'].includes(data.status) && (
              <Button onClick={() => setLifecycleAction('relist')}>Relist offer</Button>
            )}
            {data.status !== 'ARCHIVED' && (
              <Button onClick={() => setLifecycleAction('archive')}>Archive offer</Button>
            )}
            {data.status === 'ARCHIVED' && (
              <Button danger onClick={() => setLifecycleAction('delete')}>
                Delete offer
              </Button>
            )}
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
                  <li key={i}>{typeof iss === 'string' ? iss : (iss.message ?? iss.detail)}</li>
                ))}
              </ul>
            ) : (
              'Review the automated checks below, make the changes, then resubmit.'
            )
          }
        />
      )}
      {submission?.status === 'QC_PENDING' && (
        <Alert
          type="info"
          showIcon
          message="In QC review"
          description={`Submitted ${submission.ageHours ?? 0}h ago. Most listings are reviewed within 24 hours.`}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Product" style={{ marginBottom: 16 }}>
            <Flex gap={16} wrap>
              <Avatar
                shape="square"
                size={96}
                src={data.productImage}
                style={{ background: '#f0f0f0' }}
              >
                {data.productTitle?.[0]}
              </Avatar>
              <div style={{ flex: 1, minWidth: 220 }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Brand">{data.brandName ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Category">{data.categoryPath}</Descriptions.Item>
                  <Descriptions.Item label="Variant">
                    {data.variantLabel ?? 'Default'}
                  </Descriptions.Item>
                  <Descriptions.Item label="SKU">{variant?.sku}</Descriptions.Item>
                  <Descriptions.Item label="Seller SKU">{data.sellerSku ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Barcode / EAN">{variant?.ean ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="HSN">{product?.hsnCode ?? '—'}</Descriptions.Item>
                </Descriptions>
              </div>
            </Flex>
            {product?.description && (
              <>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 4 }}>
                  Description
                </Typography.Paragraph>
                <Typography.Paragraph>{product.description}</Typography.Paragraph>
              </>
            )}
            <Button
              onClick={() => {
                variantForm.setFieldsValue({
                  sellerSku: data.sellerSku,
                  sku: variant?.sku,
                  barcode: variant?.ean,
                  taxCode: data.taxCode,
                  weightG: variant?.weightG,
                  dimsL: variant?.dimsCm?.l,
                  dimsW: variant?.dimsCm?.w,
                  dimsH: variant?.dimsCm?.h,
                });
                setVariantImages(variant?.images ?? []);
                setVariantOpen(true);
              }}
            >
              Edit variant details
            </Button>
          </Card>

          {submission?.autoChecks?.length > 0 && (
            <Card title="QC auto-checks" size="small">
              <List
                dataSource={submission.autoChecks}
                renderItem={(c) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={CHECK_ICON[c.result]}
                      title={c.label}
                      description={c.detail ?? undefined}
                    />
                    <Tag
                      color={c.result === 'PASS' ? 'green' : c.result === 'WARN' ? 'gold' : 'red'}
                    >
                      {c.result}
                    </Tag>
                  </List.Item>
                )}
              />
            </Card>
          )}

          <Card title="Customer preview" style={{ marginTop: 16 }}>
            <Flex gap={16} wrap>
              <Avatar
                shape="square"
                size={88}
                src={data.preview?.images?.[0]?.previewUrl ?? data.preview?.images?.[0]}
              >
                {data.preview?.title?.[0]}
              </Avatar>
              <div>
                <Typography.Title level={5}>{data.preview?.title}</Typography.Title>
                <Typography.Text type="secondary">{data.preview?.brandName}</Typography.Text>
                <br />
                <Tag color={data.preview?.visible ? 'green' : 'default'}>
                  {data.preview?.visible ? 'Customer visible' : 'Not customer visible'}
                </Tag>
              </div>
            </Flex>
            <Typography.Paragraph style={{ marginTop: 12 }}>
              {data.preview?.description}
            </Typography.Paragraph>
            <Space wrap>
              {data.preview?.variants?.map((item) => (
                <Tag key={item.id} color={item.available ? 'blue' : 'default'}>
                  {item.label} · {item.available ? 'Available' : 'Unavailable'}
                </Tag>
              ))}
            </Space>
          </Card>

          <Card title="Version history" style={{ marginTop: 16 }}>
            <List
              size="small"
              dataSource={data.revisions ?? []}
              locale={{ emptyText: 'No revisions yet' }}
              renderItem={(revision) => (
                <List.Item>
                  <List.Item.Meta
                    title={`Version ${revision.version ?? '—'}`}
                    description={
                      <>
                        <Typography.Text type="secondary">
                          {revision.status} · {revision.changes?.length ?? 0} changed fields
                        </Typography.Text>
                        {revision.changes?.map((change, index) => (
                          <div key={`${change.field}-${index}`}>
                            <Typography.Text code>{change.field}</Typography.Text>{' '}
                            {String(change.from ?? change.before ?? '—')} →{' '}
                            {String(change.to ?? change.after ?? '—')}
                          </div>
                        ))}
                      </>
                    }
                  />
                  <Tag>{revision.status}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Price & stock" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Flex justify="space-between" align="center">
                <Statistic
                  title="Selling price"
                  valueRender={() => <MoneyText paise={data.sellingPricePaise} strong />}
                />
                <Statistic
                  title="MRP"
                  valueRender={() => <MoneyText paise={data.mrpPaise} type="secondary" />}
                />
              </Flex>
              <>
                <QuickEdit
                  label="Update price (₹)"
                  initial={paiseToRupees(data.sellingPricePaise)}
                  max={paiseToRupees(data.mrpPaise)}
                  loading={priceMut.isPending}
                  onSave={(v) => priceMut.mutate(v)}
                />
                <Button
                  onClick={() => {
                    scheduleForm.setFieldsValue({
                      price: paiseToRupees(data.sellingPricePaise),
                      mrp: paiseToRupees(data.mrpPaise),
                    });
                    setScheduleOpen(true);
                  }}
                >
                  Schedule price
                </Button>
              </>
              <>
                <QuickEdit
                  label="Update stock"
                  initial={data.stock}
                  loading={stockMut.isPending}
                  integer
                  onSave={(v) => stockMut.mutate(v)}
                />
              </>
            </Space>
          </Card>

          <Card title="On this listing" size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Flex justify="space-between">
                <Typography.Text type="secondary">Buy box</Typography.Text>
                <Typography.Text strong>
                  {data.buyBoxWinner ? 'Winning' : 'Not winning'}
                </Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text type="secondary">Other sellers on this variant</Typography.Text>
                <Typography.Text strong>{data.competingOffers}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text type="secondary">Fulfilment</Typography.Text>
                <Tag
                  color={data.fulfillmentType === 'ARISE' ? 'geekblue' : 'default'}
                  style={{ margin: 0 }}
                >
                  {data.fulfillmentType === 'ARISE' ? 'By Arise' : 'Self-ship'}
                </Tag>
              </Flex>
            </Space>
          </Card>

          <Card title="Listing quality" size="small" style={{ marginTop: 16 }}>
            <Progress
              percent={data.quality?.score ?? 0}
              status={(data.quality?.score ?? 0) >= 70 ? 'normal' : 'exception'}
            />
            <List
              size="small"
              dataSource={data.quality?.recommendations ?? []}
              renderItem={(item) => <List.Item>{item.message}</List.Item>}
            />
          </Card>

          {feePreview && (
            <Card title="Fee preview" size="small" style={{ marginTop: 16 }}>
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Commission">
                  <MoneyText paise={feePreview.commissionPaise} />
                </Descriptions.Item>
                <Descriptions.Item label="Closing fee">
                  <MoneyText paise={feePreview.closingFeePaise} />
                </Descriptions.Item>
                <Descriptions.Item label="Expected net">
                  <MoneyText paise={feePreview.netPaise} strong />
                </Descriptions.Item>
                <Descriptions.Item label="Buy-box price">
                  {feePreview.buyBoxCompetitive ? 'Competitive' : 'Above competitor'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
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
      <Modal
        title={`${lifecycleAction ?? ''} listing offer`}
        open={Boolean(lifecycleAction)}
        onCancel={() => {
          setLifecycleAction(null);
          setReason('');
        }}
        onOk={() => lifecycleMut.mutate()}
        confirmLoading={lifecycleMut.isPending}
        okButtonProps={{
          disabled: ['deactivate', 'archive', 'delete'].includes(lifecycleAction) && !reason.trim(),
        }}
      >
        {['deactivate', 'archive', 'delete'].includes(lifecycleAction) ? (
          <>
            <Typography.Paragraph>
              Give a reason. The canonical customer product is preserved.
            </Typography.Paragraph>
            <Input.TextArea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </>
        ) : (
          <Typography.Paragraph>
            This restores only your offer on the live canonical product.
          </Typography.Paragraph>
        )}
      </Modal>
      <Modal
        title="Schedule a price"
        open={scheduleOpen}
        onCancel={() => setScheduleOpen(false)}
        onOk={() => scheduleForm.submit()}
        confirmLoading={scheduleMut.isPending}
      >
        <Form
          form={scheduleForm}
          layout="vertical"
          onFinish={(values) => scheduleMut.mutate(values)}
        >
          <Form.Item name="price" label="Selling price (₹)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="mrp" label="MRP (₹)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="scheduledAt" label="Effective at" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="Edit variant and offer metadata"
        open={variantOpen}
        onCancel={() => setVariantOpen(false)}
        onOk={() => variantForm.submit()}
        confirmLoading={variantMut.isPending}
        width={720}
      >
        <Form form={variantForm} layout="vertical" onFinish={(values) => variantMut.mutate(values)}>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="sellerSku" label="Seller SKU">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="sku" label="Catalogue SKU">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="barcode" label="Barcode / EAN">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="taxCode" label="Tax code">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="weightG" label="Weight (g)">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={8} sm={6}>
              <Form.Item name="dimsL" label="Length (cm)">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={8} sm={6}>
              <Form.Item name="dimsW" label="Width (cm)">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={8} sm={6}>
              <Form.Item name="dimsH" label="Height (cm)">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Variant media">
            <ImageUpload
              value={variantImages}
              onChange={setVariantImages}
              maxCount={4}
              label={variant?.label ?? 'Variant'}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
