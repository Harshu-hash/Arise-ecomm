import { App, Button, Card, Flex, Input, Skeleton, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { cmsApi, cmsKeys } from '../api/cms.api';

const MAX_BODY = 100_000;
const EMPTY_LINKS = { website: '', careers: '', press: '', social: '' };

export default function AboutArisePage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [note, setNote] = useState('');
  const [links, setLinks] = useState(EMPTY_LINKS);
  const pages = useQuery({ queryKey: cmsKeys.staticPages, queryFn: () => cmsApi.staticPages() });
  const pageId = pages.data?.data.find((item) => item.slug === 'about')?.id;
  const page = useQuery({
    queryKey: cmsKeys.staticPage(pageId),
    queryFn: () => cmsApi.staticPage(pageId),
    enabled: Boolean(pageId),
  });

  useEffect(() => {
    if (page.data) {
      setBody(page.data.data.body);
      setLinks(Object.fromEntries(Object.entries(EMPTY_LINKS).map(([key]) => [key, page.data.data.links?.[key] ?? ''])));
      setNote('');
    }
  }, [page.data]);

  const publish = useMutation({
    mutationFn: () => cmsApi.updateStaticPage(pageId, {
      body,
      materialChange: false,
      note,
      links: Object.fromEntries(Object.entries(links).map(([key, value]) => [key, value.trim() || null])),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cms', 'staticPages'] });
      message.success('About Arise published');
    },
    onError: (error) => message.error(Object.values(error.fieldErrors ?? {}).flat()[0] ?? error.message),
  });

  if (pages.isLoading || (pageId && page.isLoading)) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (pages.error || page.error) {
    return <ErrorState error={pages.error ?? page.error} onRetry={() => { pages.refetch(); page.refetch(); }} />;
  }

  const record = page.data?.data;

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="About Arise"
        breadcrumbs={[{ label: 'Content' }, { label: 'About Arise' }]}
        subtitle="Publish the information customers see in Account → About Arise."
        tags={record && <StatusTag domain="staticPage" code={record.status} />}
        meta={record?.publishedAt && <Typography.Text type="secondary">Published <DateText value={record.publishedAt} /></Typography.Text>}
        actions={<Button type="primary" onClick={() => publish.mutate()} loading={publish.isPending} disabled={!body.trim() || body.length > MAX_BODY || !pageId}>Publish</Button>}
      />

      <Card>
        <Flex vertical gap={12}>
          <Typography.Text strong>Customer-facing content</Typography.Text>
          <Input.TextArea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            autoSize={{ minRows: 12, maxRows: 28 }}
            placeholder="Write what customers should know about Arise."
            showCount
            maxLength={MAX_BODY}
          />
          <Typography.Text strong>Links</Typography.Text>
          {[
            ['website', 'Website'],
            ['careers', 'Careers page'],
            ['press', 'Press & media'],
            ['social', 'Social media'],
          ].map(([key, label]) => (
            <Flex vertical gap={4} key={key}>
              <Typography.Text type="secondary">{label}</Typography.Text>
              <Input
                type="url"
                value={links[key]}
                onChange={(event) => setLinks((current) => ({ ...current, [key]: event.target.value }))}
                placeholder="https://"
                maxLength={500}
              />
            </Flex>
          ))}
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Version note (optional)"
            maxLength={200}
          />
        </Flex>
      </Card>
    </Flex>
  );
}
