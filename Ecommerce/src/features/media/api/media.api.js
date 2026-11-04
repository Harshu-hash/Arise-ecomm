import { baseApi } from '@core/api/baseApi';
import { mapMediaUpload } from './media.mapper';

const progressListeners = new Map();
export const subscribeToUploadProgress = (uploadKey, listener) => {
  progressListeners.set(uploadKey, listener);
  return () => progressListeners.delete(uploadKey);
};
const reportProgress = (uploadKey, event) => {
  if (!event.total) return;
  progressListeners.get(uploadKey)?.(Math.round((event.loaded / event.total) * 100));
};

const uploadQuery =
  purpose =>
  ({ uploadKey, asset }) => {
    const body = new FormData();
    body.append('file', { uri: asset.uri, type: asset.type, name: asset.fileName });
    body.append('purpose', purpose);
    return {
      url: '/media/uploads',
      method: 'POST',
      data: body,
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Upload-Name': asset.fileName,
        'X-Upload-Type': asset.type,
        'X-Upload-Size': String(asset.fileSize),
      },
      onUploadProgress: event => reportProgress(uploadKey, event),
    };
  };

export const mediaApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    uploadReturnEvidence: builder.mutation({
      query: uploadQuery('RETURN_EVIDENCE'),
      transformResponse: mapMediaUpload,
    }),
    uploadReviewMedia: builder.mutation({
      query: uploadQuery('REVIEW_MEDIA'),
      transformResponse: mapMediaUpload,
    }),
    uploadProfileImage: builder.mutation({
      query: uploadQuery('PROFILE_IMAGE'),
      transformResponse: mapMediaUpload,
    }),
    uploadSupportAttachment: builder.mutation({
      query: uploadQuery('SUPPORT_ATTACHMENT'),
      transformResponse: mapMediaUpload,
    }),
  }),
});
export const {
  useUploadReturnEvidenceMutation,
  useUploadReviewMediaMutation,
  useUploadProfileImageMutation,
  useUploadSupportAttachmentMutation,
} = mediaApi;
