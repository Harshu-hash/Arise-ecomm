import { Alert, App, Button, Drawer, Flex, Form, Input, Select, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiError } from '@core/api/errors';
import { qk, queryClient } from '@core/api/queryClient';
import { SCOPE_DIMENSIONS, SCOPE_LIMITS } from '@core/rbac/scopes';
import { ROLE_TEMPLATES, buildRoleFromTemplate } from '@core/rbac/roleTemplates';
import { rolesApi } from '@admin/features/adminUsers/api/adminUsers.api';
import PermissionMatrix from './PermissionMatrix';
import { sensitiveCount } from './permissionSelection';

const SCOPE_OPTIONS = [
  ...SCOPE_DIMENSIONS.map((d) => ({ value: d.key, label: d.label })),
  ...SCOPE_LIMITS.map((l) => ({ value: l.key, label: l.label })),
];

const TEMPLATE_OPTIONS = ROLE_TEMPLATES.map((t) => ({ value: t.key, label: t.name }));

/**
 * Create a new role, or edit a custom one. System roles open read-only — the
 * server rejects editing them, so the form mirrors that and offers Clone
 * instead (handled by the list page). Saving a role is a privilege change, so
 * the API turns it into a maker-checker request rather than applying it live.
 */
export default function RoleEditorDrawer({ open, role, onClose }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const isEdit = Boolean(role);
  const readOnly = Boolean(role?.system);
  const permissions = Form.useWatch('permissions', form) ?? [];

  useEffect(() => {
    if (!open) return;
    if (role) {
      form.setFieldsValue({
        name: role.name,
        description: role.description,
        scopedBy: role.scopedBy ?? [],
        permissions: role.permissions ?? [],
      });
    } else {
      form.setFieldsValue({ name: '', description: '', scopedBy: [], permissions: [] });
    }
  }, [open, role, form]);

  const applyTemplate = (key) => {
    const template = ROLE_TEMPLATES.find((t) => t.key === key);
    if (!template) return;
    const built = buildRoleFromTemplate(template);
    form.setFieldsValue({ scopedBy: built.scopedBy, permissions: built.permissions });
    message.info(`Loaded "${template.name}" as a starting point — adjust it, then save.`);
  };

  const onApprovalQueued = () => {
    queryClient.invalidateQueries({ queryKey: qk.roles.all });
    queryClient.invalidateQueries({ queryKey: qk.approvals.all });
    message.success('Sent for approval. The role takes effect once a second admin approves.');
    close();
  };

  const save = useMutation({
    mutationFn: (values) => {
      const payload = {
        name: values.name,
        description: values.description ?? '',
        scopedBy: values.scopedBy ?? [],
        permissions: values.permissions,
      };
      return isEdit ? rolesApi.update(role.id, { ...payload, version: role.version }) : rolesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.roles.all });
      message.success(isEdit ? 'Role saved' : 'Role created');
      close();
    },
    onError: (e) => {
      // Role changes are four-eyed: a 202 is the expected happy path here.
      if (e instanceof ApiError && e.needsApproval) return onApprovalQueued();
      if (e instanceof ApiError && e.isVersionConflict) {
        message.warning('Someone else changed this role. Reopen it and try again.');
        queryClient.invalidateQueries({ queryKey: qk.roles.all });
        return;
      }
      if (e instanceof ApiError && e.fieldErrors) {
        form.setFields(Object.entries(e.fieldErrors).map(([name, msg]) => ({ name, errors: [msg] })));
        return;
      }
      message.error(e.message);
    },
  });

  const close = () => { form.resetFields(); onClose(); };
  const sensitive = sensitiveCount(permissions);

  return (
    <Drawer
      open={open}
      onClose={close}
      width={880}
      title={readOnly ? `${role.name} (system role)` : isEdit ? `Edit ${role.name}` : 'Create role'}
      extra={
        !readOnly && (
          <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
            {isEdit ? 'Save and send for approval' : 'Create and send for approval'}
          </Button>
        )
      }
    >
      <Form form={form} layout="vertical" disabled={readOnly || save.isPending} onFinish={save.mutate}>
        {readOnly && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="System roles cannot be edited"
            description="Clone this role from the list to create an editable copy you can narrow."
          />
        )}
        {!readOnly && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Creating or changing a role needs a second approver"
            description="Your changes are saved as a request and apply only once another admin approves them."
          />
        )}

        <Flex gap={16} wrap>
          <Form.Item
            name="name"
            label="Role name"
            style={{ flex: '1 1 260px' }}
            rules={[{ required: true, message: 'Give the role a name.' }]}
          >
            <Input placeholder="e.g. Regional Support Lead" />
          </Form.Item>
          {!readOnly && !isEdit && (
            <Form.Item label="Start from a template" style={{ flex: '1 1 260px' }}>
              <Select
                allowClear
                placeholder="Optional — copy a system role's permissions"
                options={TEMPLATE_OPTIONS}
                optionFilterProp="label"
                showSearch
                onChange={applyTemplate}
              />
            </Form.Item>
          )}
        </Flex>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} maxLength={200} placeholder="What this role is for and who should hold it." />
        </Form.Item>

        <Form.Item
          name="scopedBy"
          label="Scoped by"
          extra="Dimensions an admin must fill in when assigning this role (e.g. categories, sellers, refund limit). Leave empty for platform-wide access."
        >
          <Select mode="multiple" placeholder="Unrestricted" options={SCOPE_OPTIONS} />
        </Form.Item>

        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <Typography.Text strong>Permissions</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {permissions.length} selected{sensitive > 0 ? ` · ${sensitive} sensitive` : ''}
          </Typography.Text>
        </Flex>

        {sensitive > 0 && !readOnly && (
          <Alert
            type="warning"
            showIcon
            banner
            style={{ marginBottom: 12 }}
            message={`This role grants ${sensitive} sensitive permission${sensitive === 1 ? '' : 's'} (marked with a warning). Some of these go through maker-checker when used.`}
          />
        )}

        <Form.Item
          name="permissions"
          valuePropName="value"
          trigger="onChange"
          rules={[{ validator: (_r, v) => (v?.length ? Promise.resolve() : Promise.reject(new Error('Select at least one permission.'))) }]}
        >
          <PermissionMatrix disabled={readOnly} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
