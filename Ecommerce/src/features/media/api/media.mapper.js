import { mediaUploadResponseSchema } from './media.schemas';

export const mapMediaUpload = payload => mediaUploadResponseSchema.parse(payload).data;
