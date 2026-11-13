import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Empty, Flex, Popconfirm, Row, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import { catalogApi, catalogKeys } from '../api/catalog.api';
import SizeChartEditorModal from '../components/SizeChartEditorModal';

/**
 * Size charts as the app renders them, so what a reviewer checks here is what
 * a customer sees on the product page — now editable.
 */
export default function SizeChartsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: catalogKeys.sizeCharts,
    queryFn: () => catalogApi.sizeCharts(),
  });

  const categoriesQuery = useQuery({
    queryKey: catalogKeys.categories({ pageSize: 200 }),
    queryFn: () => catalogApi.categories({ pageSize: 200 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: catalogKeys.sizeCharts });

  const save = useMutation({
    mutationFn: (values) =>
      editing ? catalogApi.updateSizeChart(editing.id, values) : catalogApi.createSizeChart(values),
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
      setEditing(null);
      message.success(editing ? 'Size chart saved' : 'Size chart created');
    },
    onError: (e) => message.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => catalogApi.deleteSizeChart(id),
    onSuccess: () => {
      invalidate();
      message.success('Size chart deleted');
    },
    onError: (e) => message.error(e.message),
  });

  if (isLoading) return <FullPageSpinner label="Loading size charts…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Could not load size charts" />;

  const charts = data?.data ?? [];
  const categoryOptions = (categoriesQuery.data?.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (chart) => { setEditing(chart); setModalOpen(true); };

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Size charts"
        breadcrumbs={[{ label: 'Catalog' }, { label: 'Size charts' }]}
        subtitle="Attached to apparel and footwear listings. Wrong measurements are a leading cause of returns."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
            New size chart
          </Button>
        }
      />

      {charts.length === 0 ? (
        <Card size="small">
          <Empty description="No size charts yet">
            <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Create one</Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[12, 12]}>
          {charts.map((chart) => (
            <Col key={chart.id} xs={24} xl={12}>
              <Card
                size="small"
                title={chart.name}
                extra={
                  <Flex gap={6} align="center">
                    {chart.categoryName && <Tag style={{ marginInlineEnd: 0 }}>{chart.categoryName}</Tag>}
                    <Tag style={{ marginInlineEnd: 0 }}>{chart.productCount} products</Tag>
                    <Space size={0}>
                      <Button size="small" type="text" onClick={() => openEdit(chart)}>Edit</Button>
                      <Popconfirm
                        title="Delete this size chart?"
                        description={chart.productCount > 0 ? 'Products still use it — this will be blocked.' : 'This cannot be undone.'}
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => remove.mutate(chart.id)}
                      >
                        <Button size="small" type="text" danger>Delete</Button>
                      </Popconfirm>
                    </Space>
                  </Flex>
                }
              >
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(row) => row.join('-')}
                  dataSource={chart.rows}
                  scroll={{ x: 'max-content' }}
                  columns={chart.columns.map((c, i) => ({
                    title: i === 0 ? c : `${c} (${chart.unit})`,
                    render: (_v, row) => (
                      <Typography.Text className="tabular" strong={i === 0}>
                        {row[i]}
                      </Typography.Text>
                    ),
                  }))}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <SizeChartEditorModal
        open={modalOpen}
        editing={editing}
        categories={categoryOptions}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={(v) => save.mutate(v)}
        loading={save.isPending}
      />
    </Flex>
  );
}
