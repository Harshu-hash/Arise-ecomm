import { AxiosError } from 'axios';

const LATENCY_MS = 350;
let mediaCounter = 1;
const uploads = new Map();
const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});
const reject = (config, status, code, message) => {
  throw new AxiosError(
    message,
    code,
    config,
    null,
    response(config, { error: { code, message } }, status),
  );
};

export const resetCustomerMediaFixture = () => {
  mediaCounter = 1;
  uploads.clear();
};

export const customerMediaFixtureAdapter = async config => {
  await wait();
  if (config.url === '/media/uploads' && config.method === 'post') {
    const mimeType = config.headers?.['X-Upload-Type'];
    const sizeBytes = Number(config.headers?.['X-Upload-Size']);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return reject(config, 415, 'MEDIA_TYPE_UNSUPPORTED', 'Choose a JPEG, PNG, or WebP image.');
    }
    if (!sizeBytes || sizeBytes > 8 * 1024 * 1024) {
      return reject(config, 413, 'MEDIA_TOO_LARGE', 'Choose an image smaller than 8 MB.');
    }
    config.onUploadProgress?.({ loaded: Math.round(sizeBytes / 2), total: sizeBytes });
    const id = `media-${mediaCounter++}`;
    const upload = {
      id,
      url: `https://cdn.example.com/returns/${id}.jpg`,
      thumbnailUrl: `https://cdn.example.com/returns/${id}-thumb.jpg`,
      mimeType,
      sizeBytes,
      status: 'READY',
    };
    uploads.set(id, upload);
    config.onUploadProgress?.({ loaded: sizeBytes, total: sizeBytes });
    return response(config, { data: upload }, 201);
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};
export const getMediaFixture = mediaId => uploads.get(mediaId) ?? null;
