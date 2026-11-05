import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@core/api/axiosInstance';
import { exportJobsApi, savedViewsApi } from '@core/api/foundationApi';
import AsyncActionButton from './AsyncActionButton';
import ActionReasonModal from './ActionReasonModal';
import AttachmentList from './AttachmentList';
import AuditTimeline from './AuditTimeline';
import DataTable from './DataTable/DataTable';
import DateRangeCompare from './DateRangeCompare';
import DestructiveActionModal from './DestructiveActionModal';
import DocumentUpload from './DocumentUpload';
import DocumentViewer from './DocumentViewer';
import EntityPicker from './EntityPicker';
import ExportJobButton from './ExportJobButton';
import ExportJobDrawer from './ExportJobDrawer';
import MediaWorkflowUpload from './MediaWorkflowUpload';
import PageState from './PageState';
import { PAGE_STATES } from './pageStates';
import SavedViewsMenu from './SavedViewsMenu';
import SlaCountdown from './SlaCountdown';

function wrapped(node) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><AntApp>{node}</AntApp></QueryClientProvider>);
}

afterEach(() => vi.restoreAllMocks());

describe('S9 shared component states', () => {
  it('prevents duplicate async commands', async () => {
    const user = userEvent.setup();
    let release;
    const action = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    wrapped(<AsyncActionButton onAction={action}>Submit</AsyncActionButton>);
    const button = screen.getByRole('button', { name: 'Submit' });
    await user.click(button); await user.click(button);
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => release());
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('announces SLA breach state', () => {
    wrapped(<SlaCountdown dueAt="2026-01-01T10:00:00Z" now="2026-01-01T12:30:00Z" />);
    expect(screen.getByRole('timer')).toHaveTextContent('2h 30m overdue');
  });

  it('renders attachment preview, download and accessible removal controls', async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    wrapped(<AttachmentList removable onRemove={remove} onPreview={() => {}} attachments={[{ id: 'MED-1', fileName: 'invoice.pdf', mimeType: 'application/pdf', status: 'READY', downloadUrl: '/invoice.pdf' }]} />);
    expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute('rel', 'noopener noreferrer');
    await user.click(screen.getByRole('button', { name: 'Remove invoice.pdf' }));
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'MED-1' }));
  });

  it.each([
    [PAGE_STATES.INITIAL_LOADING, 'loading'],
    [PAGE_STATES.EMPTY, 'Nothing here yet'],
    [PAGE_STATES.PARTIAL_FAILURE, 'Some information could not be loaded'],
    [PAGE_STATES.STALE, 'This data may be out of date'],
    [PAGE_STATES.CONFLICT, 'This record changed elsewhere'],
  ])('renders the %s page convention', (state, expected) => {
    const { container } = wrapped(<PageState state={state}>Ready</PageState>);
    if (expected === 'loading') expect(container.querySelector('.ant-skeleton')).toBeTruthy();
    else expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('provides a labelled keyboard-operable upload control', async () => {
    const user = userEvent.setup();
    wrapped(<MediaWorkflowUpload value={[]} onChange={() => {}} label="Product" />);
    const add = screen.getByRole('button', { name: 'Add image' });
    await user.tab();
    expect(add).toHaveFocus();
  });

  it('closes the reason modal from the keyboard and exposes labelled fields', async () => {
    const user = userEvent.setup();
    const cancel = vi.fn();
    wrapped(<ActionReasonModal open onCancel={cancel} reasonCodes={[{ value: 'DAMAGED', label: 'Damaged' }]} />);
    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(cancel).toHaveBeenCalled());
  });

  it('opens a table row with Enter as well as pointer input', () => {
    const open = vi.fn();
    wrapped(<DataTable tableId="a11y-test" columns={[{ title: 'Name', dataIndex: 'name', key: 'name' }]} rows={[{ id: 'ROW-1', name: 'Alice' }]} meta={{ total: 1 }} tableState={{ page: 1, pageSize: 25, sort: '', queryParams: {}, setPage: () => {} }} onRowClick={open} />);
    fireEvent.keyDown(screen.getByLabelText('Open Alice'), { key: 'Enter' });
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'ROW-1' }));
  });

  it('renders document upload and durable document preview states', () => {
    const { unmount } = wrapped(<DocumentUpload value={[]} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Add file' })).toBeInTheDocument();
    unmount();
    wrapped(<DocumentViewer readOnly document={{ id: 'MED-1', label: 'GST certificate', fileName: 'gst.png', mimeType: 'image/png', status: 'READY', previewUrl: '/media/MED-1/preview', downloadUrl: '/media/MED-1/download', uploadedAt: '2026-01-01T00:00:00Z' }} />);
    expect(screen.getByRole('img', { name: 'GST certificate' })).toHaveAttribute('src', '/media/MED-1/preview');
    expect(screen.getByRole('link', { name: 'Download gst.png' })).toBeInTheDocument();
  });

  it('normalizes audit events and toggles date comparison', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    wrapped(<><AuditTimeline events={[{ id: 'AUD-1', action: 'LISTING_UPDATED', actionLabel: 'Listing updated', createdAt: '2026-01-01T00:00:00Z', actor: { id: 'USR-1', name: 'Asha', type: 'seller' } }]} /><DateRangeCompare value={{ from: '2026-01-01T00:00:00Z', to: '2026-01-31T23:59:59Z', compare: false }} onChange={change} /></>);
    expect(screen.getByText('Listing updated')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Compare previous period' }));
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ compare: true }));
  });

  it('shows the affected-resource summary before a destructive action', () => {
    wrapped(<DestructiveActionModal open title="Delete listing" onCancel={() => {}} onConfirm={() => {}} affectedResources={[{ label: 'Variants', count: 3 }, 'Active promotion']} />);
    expect(screen.getByText('2 affected resources')).toBeInTheDocument();
    expect(screen.getByText('Variants: 3')).toBeInTheDocument();
    expect(screen.getByText('Active promotion')).toBeInTheDocument();
  });

  it('renders async entity, saved-view and export-job foundation states', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: [{ value: 'SELLER-1', label: 'Asha Stores' }] });
    vi.spyOn(savedViewsApi, 'list').mockResolvedValue([]);
    vi.spyOn(exportJobsApi, 'list').mockResolvedValue([]);
    wrapped(<><EntityPicker entity="sellers" placeholder="Choose seller" /><SavedViewsMenu tableId="orders" tableState={{ write: () => {} }} /><ExportJobButton resource="orders" /><ExportJobDrawer open onClose={() => {}} /></>);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Views' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export/ })).toBeInTheDocument();
    expect(await screen.findByText('No exports yet')).toBeInTheDocument();
  });
});
