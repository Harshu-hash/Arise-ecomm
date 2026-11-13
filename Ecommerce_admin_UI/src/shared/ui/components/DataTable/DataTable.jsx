/* eslint-disable max-lines -- the table intentionally keeps desktop/mobile/selection behavior in one audited primitive */
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Descriptions, Flex, Segmented, Space, Table, Tabs, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useThemeStore } from '@theme/themeStore';
import useBreakpoint from '@ui/hooks/useBreakpoint';
import { glossify } from '@ui/utils/glossify';
import EmptyState from '../EmptyState';
import ErrorState from '../ErrorState';
import ExportJobButton from '../ExportJobButton';
import SavedViewsMenu from '../SavedViewsMenu';
import BulkActionBar from './BulkActionBar';
import ColumnChooser from './ColumnChooser';
import MobileCardList from './MobileCardList';
import { clearPrefs, loadPrefs, resolveColumns, savePrefs } from './columnPrefs';
import { estimateColumnWidth, formatNumber, sortOrderFor, sorterToSort, tabsFromFacets } from './helpers';

/**
 * The list primitive every module builds on.
 *
 * Everything that defines the result set — page, sort, filters, tab — lives in
 * the URL via `tableState`; this component never filters or sorts locally,
 * which keeps it honest about what the server has to support.
 */
export default function DataTable({
  tableId,
  columns,
  rows = [],
  meta,
  loading,
  error,
  onRetry,
  tableState,
  rowKey = 'id',
  onRowClick,
  tabs,
  facetField = 'status',
  selection,
  bulkActions = [],
  toolbarLeft,
  toolbarRight,
  onExport,
  exportJob,
  emptyProps,
  mobileCard,
  virtual = false,
  scrollX,
  savedViews = false,
  refreshing = false,
  partialError,
  stale = false,
}) {
  const { isMobile, columnPriorityCutoff } = useBreakpoint();
  const globalDensity = useThemeStore((s) => s.density);
  const setDensity = useThemeStore((s) => s.setDensity);

  const [prefs, setPrefs] = useState(() => loadPrefs(tableId));
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const density = prefs?.density ?? globalDensity;

  useEffect(() => {
    // Clearing the selection when the result set changes avoids acting on rows
    // the user can no longer see.
    setSelectedKeys([]);
    setAllMatchingSelected(false);
  }, [tableState?.queryParams]);

  const updatePrefs = (next) => {
    setPrefs(next);
    savePrefs(tableId, next);
  };

  const updateDensity = (next) => {
    updatePrefs({ ...(prefs ?? {}), density: next });
    setDensity(next);
  };

  const visibleColumns = useMemo(
    () => resolveColumns({ columns, prefs, priorityCutoff: columnPriorityCutoff }),
    [columns, prefs, columnPriorityCutoff],
  );

  const antColumns = useMemo(
    () =>
      visibleColumns.map((c) => ({
        ...c,
        // Width is estimated from the original plain-string title; the
        // abbreviation tooltip is layered on after, for display only.
        width: estimateColumnWidth(c),
        title: glossify(c.title),
        sortOrder: c.sorter ? sortOrderFor(tableState?.sort, c.key ?? c.dataIndex) : undefined,
        sorter: c.sorter ? true : undefined,
        showSorterTooltip: false,
      })),
    [visibleColumns, tableState?.sort],
  );

  const tabItems = useMemo(
    () => (tabs ? tabsFromFacets({ tabs, facets: meta?.facets, facetField }) : null),
    [tabs, meta?.facets, facetField],
  );

  const total = meta?.total ?? rows.length;

  const defaultMobileCard = (row) => (
    <Descriptions size="small" column={1} colon={false}>
      {columns.filter((column) => (column.priority ?? 1) <= 2 && column.key !== 'actions').map((column) => {
        const key = column.key ?? column.dataIndex;
        const raw = typeof column.dataIndex === 'string' ? row[column.dataIndex] : undefined;
        return <Descriptions.Item key={key} label={typeof column.title === 'string' ? column.title : column.exportLabel ?? key}>{column.render ? column.render(raw, row) : String(raw ?? '—')}</Descriptions.Item>;
      })}
    </Descriptions>
  );

  if (error) {
    return (
      <Card variant="borderless">
        <ErrorState error={error} onRetry={onRetry} title="Could not load this list" />
      </Card>
    );
  }

  const emptyNode = (
    <EmptyState
      variant={tableState?.hasFilters ? 'filtered' : 'empty'}
      onClearFilters={tableState?.clearFilters}
      {...emptyProps}
    />
  );

  const rowSelection = selection
    ? {
        selectedRowKeys: selectedKeys,
        preserveSelectedRowKeys: false,
        onChange: (keys) => {
          setSelectedKeys(keys);
          setAllMatchingSelected(false);
        },
        getCheckboxProps: selection.getCheckboxProps,
      }
    : undefined;

  return (
    <div>
      {refreshing && <Alert type="info" showIcon message="Refreshing results…" style={{ marginBottom: 8 }} />}
      {partialError && <Alert type="warning" showIcon message="Some result details could not be loaded" description={partialError.message} action={onRetry ? <Button size="small" onClick={onRetry}>Retry</Button> : null} style={{ marginBottom: 8 }} />}
      {stale && <Alert type="warning" showIcon message="These results may be out of date" action={onRetry ? <Button size="small" onClick={onRetry}>Refresh</Button> : null} style={{ marginBottom: 8 }} />}
      {tabItems && (
        <Tabs
          activeKey={tableState?.tab ?? 'all'}
          onChange={(key) => tableState?.setTab(key === 'all' ? null : key)}
          items={tabItems.map((t) => ({
            key: t.key,
            label: (
              <Space size={6}>
                {t.label}
                <Badge
                  count={t.count ?? 0}
                  showZero
                  overflowCount={99999}
                  color={t.key === (tableState?.tab ?? 'all') ? undefined : 'var(--ant-color-fill-quaternary)'}
                  style={{
                    color: t.key === (tableState?.tab ?? 'all') ? undefined : 'var(--ant-color-text-secondary)',
                    boxShadow: 'none',
                  }}
                />
              </Space>
            ),
          }))}
          style={{ marginBottom: 4 }}
        />
      )}

      <Flex justify="space-between" align="center" gap={8} wrap style={{ marginBottom: 10 }}>
        <Space size={8} wrap>
          {toolbarLeft}
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {loading ? 'Loading…' : `${formatNumber(total)} ${total === 1 ? 'record' : 'records'}`}
          </Typography.Text>
        </Space>

        <Space size={8} wrap>
          {toolbarRight}
          {savedViews && tableState && <SavedViewsMenu tableId={tableId} tableState={tableState} />}
          {!isMobile && (
            <Segmented
              size="small"
              value={density}
              onChange={updateDensity}
              options={[
                { label: 'Compact', value: 'small' },
                { label: 'Default', value: 'middle' },
                { label: 'Roomy', value: 'large' },
              ]}
            />
          )}
          {onRetry && (
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={onRetry} aria-label="Refresh list" />
            </Tooltip>
          )}
          {onExport && (
            <Tooltip title="Export these results">
              <Button icon={<DownloadOutlined />} onClick={onExport} aria-label="Export results">
                {isMobile ? null : 'Export'}
              </Button>
            </Tooltip>
          )}
          {exportJob && (
            <ExportJobButton
              {...exportJob}
              filters={{ ...(tableState?.queryParams ?? {}), ...(exportJob.filters ?? {}) }}
              selection={allMatchingSelected
                ? { mode: 'FILTERED', filters: { ...(tableState?.queryParams ?? {}), ...(exportJob.filters ?? {}), ...(tableState?.tab ? { tab: tableState.tab } : {}) } }
                : selectedKeys.length ? { mode: 'SELECTED', ids: selectedKeys } : { mode: 'FILTERED', filters: { ...(tableState?.queryParams ?? {}), ...(exportJob.filters ?? {}) } }}
              estimatedRows={allMatchingSelected ? total : selectedKeys.length || total}
            />
          )}
          {!isMobile && (
            <ColumnChooser
              columns={columns}
              prefs={prefs}
              onChange={updatePrefs}
              onReset={() => {
                clearPrefs(tableId);
                setPrefs(null);
              }}
            />
          )}
        </Space>
      </Flex>

      {selection && (
        <BulkActionBar
          selectedCount={allMatchingSelected ? total : selectedKeys.length}
          totalMatching={total}
          allMatchingSelected={allMatchingSelected}
          onSelectAllMatching={() => setAllMatchingSelected(true)}
          onClear={() => {
            setSelectedKeys([]);
            setAllMatchingSelected(false);
          }}
          actions={bulkActions.map((a) => ({
            ...a,
            onClick: (ctx) =>
              a.onClick({
                ...ctx,
                selectedKeys,
                selectedRows: rows.filter((r) => selectedKeys.includes(r[rowKey])),
                total,
                selection: allMatchingSelected
                  ? { mode: 'FILTERED', filters: { ...(tableState?.queryParams ?? {}), ...(tableState?.tab ? { tab: tableState.tab } : {}) } }
                  : { mode: 'SELECTED', ids: selectedKeys },
              }),
          }))}
        />
      )}

      {isMobile ? (
        <MobileCardList
          rows={rows}
          rowKey={rowKey}
          loading={loading}
          render={mobileCard ?? defaultMobileCard}
          onRowClick={onRowClick}
          empty={emptyNode}
          page={tableState?.page}
          pageSize={tableState?.pageSize}
          total={total}
          onPageChange={tableState?.setPage}
        />
      ) : (
        <Table
          size={density}
          columns={antColumns}
          dataSource={rows}
          rowKey={rowKey}
          loading={loading}
          rowSelection={rowSelection}
          virtual={virtual}
          scroll={{ x: scrollX ?? 'max-content', ...(virtual ? { y: 560 } : {}) }}
          sticky
          locale={{ emptyText: loading ? ' ' : emptyNode }}
          onRow={
            onRowClick
              ? (record) => ({
                  onClick: () => onRowClick(record),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowClick(record);
                    }
                  },
                  tabIndex: 0,
                  'aria-label': `Open ${record.name ?? record.title ?? record[rowKey]}`,
                  style: { cursor: 'pointer' },
                })
              : undefined
          }
          onChange={(pagination, _filters, sorter) => {
            const nextSort = sorterToSort(sorter, tableState?.sort);
            if (nextSort !== tableState?.sort) tableState?.setSort(nextSort);
          }}
          pagination={{
            current: tableState?.page ?? 1,
            pageSize: tableState?.pageSize ?? 25,
            total,
            showSizeChanger: true,
            pageSizeOptions: [25, 50, 100, 200],
            showTotal: (t, range) => `${range[0]}–${range[1]} of ${formatNumber(t)}`,
            onChange: (page, pageSize) => tableState?.setPage(page, pageSize),
            size: 'default',
          }}
        />
      )}
    </div>
  );
}
