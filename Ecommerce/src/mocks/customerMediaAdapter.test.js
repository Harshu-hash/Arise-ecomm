import { customerMediaFixtureAdapter, resetCustomerMediaFixture } from './customerMediaAdapter';

describe('customerMediaFixtureAdapter', () => {
  beforeEach(resetCustomerMediaFixture);

  it('uploads supported return evidence and reports progress', async () => {
    const progress = jest.fn();
    const response = await customerMediaFixtureAdapter({
      url: '/media/uploads',
      method: 'post',
      data: {},
      onUploadProgress: progress,
      headers: {
        'X-Upload-Type': 'image/jpeg',
        'X-Upload-Size': '2048',
        'X-Upload-Name': 'photo.jpg',
      },
    });
    expect(response.data.data).toMatchObject({ mimeType: 'image/jpeg', status: 'READY' });
    expect(progress).toHaveBeenLastCalledWith({ loaded: 2048, total: 2048 });
  });

  it('rejects oversized and unsupported files', async () => {
    await expect(
      customerMediaFixtureAdapter({
        url: '/media/uploads',
        method: 'post',
        data: {},
        headers: { 'X-Upload-Type': 'image/jpeg', 'X-Upload-Size': String(9 * 1024 * 1024) },
      }),
    ).rejects.toMatchObject({ response: { status: 413 } });
    await expect(
      customerMediaFixtureAdapter({
        url: '/media/uploads',
        method: 'post',
        data: {},
        headers: { 'X-Upload-Type': 'application/pdf', 'X-Upload-Size': '1024' },
      }),
    ).rejects.toMatchObject({ response: { status: 415 } });
  });
});
