import { App, Form } from 'antd';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImageFieldPicker from './ImageFieldPicker';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@core/api/axiosInstance', () => ({ api: { post: mocks.post } }));
vi.mock('@core/config/env', () => ({ IS_MOCK: false }));

afterEach(() => mocks.post.mockReset());

describe('ImageFieldPicker', () => {
  it('uploads live images and stores the returned URL', async () => {
    mocks.post.mockResolvedValue({ data: { url: 'https://cdn.example.com/categories/fashion.png' } });
    const { container } = render(
      <App>
        <Form><ImageFieldPicker /></Form>
      </App>,
    );
    const file = new File(['image'], 'fashion.png', { type: 'image/png' });

    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    const [path, body] = mocks.post.mock.calls[0];
    expect(path).toBe('/uploads');
    expect(body.get('purpose')).toBe('CMS_MEDIA');
    expect(body.get('file')).toBe(file);
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/categories/fashion.png',
    ));
  });
});
