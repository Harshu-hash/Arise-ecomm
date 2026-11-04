import { mapMediaUpload } from './media.mapper';

describe('media upload mapper', () => {
  it('validates a ready media upload', () => {
    expect(
      mapMediaUpload({
        data: {
          id: 'media-1',
          url: 'https://cdn.example.com/media-1.jpg',
          thumbnailUrl: 'https://cdn.example.com/media-1-thumb.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          status: 'READY',
        },
      }),
    ).toMatchObject({ id: 'media-1', status: 'READY' });
  });

  it('rejects unsupported media types', () => {
    expect(() =>
      mapMediaUpload({
        data: {
          id: 'media-1',
          url: 'https://cdn.example.com/media-1.pdf',
          thumbnailUrl: 'https://cdn.example.com/media-1-thumb.jpg',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          status: 'READY',
        },
      }),
    ).toThrow();
  });
});
