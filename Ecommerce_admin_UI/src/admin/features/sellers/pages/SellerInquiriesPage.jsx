import { App, Button, Flex, Tooltip, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useSessionStore } from '@core/auth/sessionStore';
import PageHeader from '@ui/components/PageHeader';
import FilterBar from '@ui/components/FilterBar';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { sellerKeys, sellersApi } from '../api/sellers.api';

export default function SellerInquiriesPage() {
  const { message } = App.useApp();
  const permissions = useSessionStore((store) => store.permissions);
  const canInvite = permissions.has('*') || permissions.has('sellers.application.request_info');
  const state = useUrlTableState({ defaultSort: '-submittedAt' });
  const { rows, meta, loading, fetching, error, refetch } = useListQuery({
    queryKey: sellerKeys.inquiries(state.queryParams),
    url: '/seller-inquiries',
    params: state.queryParams,
  });
  const invite = useMutation({
    mutationFn: sellersApi.inviteInquiry,
    onSuccess: () => { message.success('Seller invite sent'); refetch(); },
    onError: (error) => message.error(error.message),
  });
  const columns = [
    { key: 'businessName', title: 'Business', dataIndex: 'businessName', sorter: true, alwaysVisible: true },
    { key: 'email', title: 'Email', dataIndex: 'email', sorter: true, priority: 1, render: (value) => value ?? '—' },
    { key: 'gstin', title: 'GSTIN', dataIndex: 'gstin', priority: 1 },
    { key: 'mobile', title: 'Mobile', dataIndex: 'mobile', sorter: true, priority: 1 },
    { key: 'pickupPincode', title: 'Pickup pincode', dataIndex: 'pickupPincode', sorter: true, priority: 2 },
    { key: 'submittedAt', title: 'Received', dataIndex: 'submittedAt', sorter: true, priority: 1, render: (value) => <DateText value={value} /> },
    {
      key: 'actions', title: '', align: 'right', alwaysVisible: true,
      render: (_value, row) => (
        <Tooltip title={!row.email ? 'This older inquiry has no email address.' : !canInvite ? 'You do not have permission to send seller invites.' : row.inviteSentAt ? 'Invite already sent.' : null}>
          <Button
            size="small"
            type="primary"
            disabled={!row.email || !canInvite || Boolean(row.inviteSentAt)}
            loading={invite.isPending && invite.variables === row.id}
            onClick={() => invite.mutate(row.id)}>
            {row.inviteSentAt ? 'Invite sent' : 'Send invite'}
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Seller inquiries"
        breadcrumbs={[{ label: 'Sellers' }, { label: 'Seller inquiries' }]}
        subtitle="Customers who asked to start selling on Arise."
      />
      <FilterBar schema={[]} tableState={state} searchPlaceholder="Search business, email, mobile or pincode" />
      <DataTable
        tableId="sellerInquiries"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No seller inquiries yet', description: 'Customer submissions from Sell on Arise appear here.' }}
        mobileCard={(row) => (
          <Flex vertical gap={4}>
            <Typography.Text strong>{row.businessName}</Typography.Text>
            <Typography.Text type="secondary">{row.email ?? 'No email'} · {row.mobile}</Typography.Text>
          </Flex>
        )}
      />
    </Flex>
  );
}
