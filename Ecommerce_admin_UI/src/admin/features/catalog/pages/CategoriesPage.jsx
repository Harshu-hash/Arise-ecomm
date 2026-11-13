import {
  ApartmentOutlined,
  LockOutlined,
  PercentageOutlined,
  PlusOutlined,
  RetweetOutlined,
} from '@ant-design/icons';
import { App, Button, Card, Col, Empty, Flex, Form, Input, Modal, Row, Tag, Tree, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '@core/api/errors';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import { catalogApi, catalogKeys } from '../api/catalog.api';
import CategoryEditor from '../components/CategoryEditor';

/**
 * The taxonomy: a three-level tree beside an editor for the selected node.
 *
 * Split view rather than a list and a separate page, because category work is
 * comparative — you are usually checking a node against its siblings.
 */
export default function CategoriesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('selected');
  const [search, setSearch] = useState('');
  const [addRootOpen, setAddRootOpen] = useState(false);
  const [rootForm] = Form.useForm();

  const tree = useQuery({
    queryKey: catalogKeys.categoryTree,
    queryFn: () => catalogApi.categoryTree(),
  });

  const select = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('selected', id);
    else next.delete('selected');
    setParams(next);
  };

  const createRoot = useMutation({
    // A top-level category has no parent.
    mutationFn: (values) => catalogApi.createCategory({ ...values, parentId: null }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.categoryTree });
      setAddRootOpen(false);
      rootForm.resetFields();
      message.success('Top category created');
      if (res?.data?.id) select(res.data.id);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fieldErrors) {
        rootForm.setFields(
          Object.entries(e.fieldErrors).map(([name, msg]) => ({ name, errors: [msg] })),
        );
        return;
      }
      message.error(e.message);
    },
  });

  const treeData = useMemo(() => {
    const term = search.trim().toLowerCase();

    const toNode = (c) => {
      const children = (c.children ?? []).map(toNode).filter(Boolean);
      const selfMatches = !term || c.name.toLowerCase().includes(term);
      if (!selfMatches && children.length === 0) return null;

      return {
        key: c.id,
        title: (
          <Flex align="center" gap={6} style={{ paddingRight: 4 }}>
            <span>{c.name}</span>
            {c.gated && <Tag color="gold" style={{ marginInlineEnd: 0, fontSize: 10 }}>gated</Tag>}
            {c.status !== 'ACTIVE' && <Tag style={{ marginInlineEnd: 0, fontSize: 10 }}>hidden</Tag>}
            {c.level === 3 && c.liveListings > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {c.liveListings}
              </Typography.Text>
            )}
          </Flex>
        ),
        children,
      };
    };

    return (tree.data?.data ?? []).map(toNode).filter(Boolean);
  }, [tree.data, search]);

  const expandedKeys = useMemo(() => {
    if (!search.trim()) return undefined;
    // Expand everything while filtering, so matches deep in the tree show.
    const keys = [];
    const walk = (nodes) => {
      for (const n of nodes) {
        keys.push(n.key);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(treeData);
    return keys;
  }, [treeData, search]);

  if (tree.isLoading) return <FullPageSpinner label="Loading taxonomy…" />;
  if (tree.error) {
    return <ErrorState error={tree.error} onRetry={tree.refetch} title="Could not load the taxonomy" />;
  }

  const rootCount = tree.data?.data?.length ?? 0;

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Categories"
        breadcrumbs={[{ label: 'Catalog' }, { label: 'Categories' }]}
        subtitle="A three-level tree. Policies you set on a category — return window, GST, gating — apply to every listing beneath it."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddRootOpen(true)}>
            New category
          </Button>
        }
      />

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} lg={9}>
          <Card
            size="small"
            title="Taxonomy"
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {rootCount} top-level
              </Typography.Text>
            }
            style={{ height: '100%' }}
            styles={{ body: { paddingTop: 12 } }}
          >
            <Input.Search
              allowClear
              placeholder="Find a category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            {treeData.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No categories match" style={{ padding: '24px 0' }} />
            ) : (
              <Tree
                treeData={treeData}
                selectedKeys={selectedId ? [selectedId] : []}
                {...(expandedKeys ? { expandedKeys } : {})}
                onSelect={(keys) => select(keys[0] ?? null)}
                blockNode
                style={{ maxHeight: 580, overflowY: 'auto' }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          {selectedId ? (
            <CategoryEditor categoryId={selectedId} onSelect={select} />
          ) : (
            <NoSelection onCreate={() => setAddRootOpen(true)} />
          )}
        </Col>
      </Row>

      <Modal
        open={addRootOpen}
        onCancel={() => setAddRootOpen(false)}
        onOk={() => rootForm.submit()}
        confirmLoading={createRoot.isPending}
        title="New top category"
        okText="Create"
        destroyOnHidden
      >
        <Form
          form={rootForm}
          layout="vertical"
          requiredMark={false}
          onFinish={(v) => createRoot.mutate(v)}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Give it a name.' }]}>
            <Input autoFocus placeholder="e.g. Fashion" />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Creates a level-1 category. Add sub-categories under it later with “Add child”.
          </Typography.Text>
        </Form>
      </Modal>
    </Flex>
  );
}

/** Calm, purposeful placeholder shown until a category is picked. */
function NoSelection({ onCreate }) {
  const hints = [
    { icon: <RetweetOutlined />, label: 'Return windows' },
    { icon: <PercentageOutlined />, label: 'GST / HSN' },
    { icon: <LockOutlined />, label: 'Gating' },
  ];

  return (
    <Card
      size="small"
      style={{ height: '100%' }}
      styles={{ body: { minHeight: 440, display: 'grid', placeItems: 'center' } }}
    >
      <Flex vertical align="center" gap={18} style={{ maxWidth: 420, textAlign: 'center', padding: 24 }}>
        <div className="arise-placeholder-icon" aria-hidden>
          <ApartmentOutlined />
        </div>
        <Flex vertical gap={6} align="center">
          <Typography.Title level={5} style={{ margin: 0 }}>
            Select a category
          </Typography.Title>
          <Typography.Text type="secondary">
            Pick a category from the tree to review and edit the policies that apply to every listing beneath it.
          </Typography.Text>
        </Flex>
        <Flex gap={8} wrap justify="center">
          {hints.map((h) => (
            <span key={h.label} className="arise-chip">
              {h.icon}
              {h.label}
            </span>
          ))}
        </Flex>
        <Button type="link" icon={<PlusOutlined />} onClick={onCreate} style={{ padding: 0 }}>
          Create a top-level category
        </Button>
      </Flex>
    </Card>
  );
}
