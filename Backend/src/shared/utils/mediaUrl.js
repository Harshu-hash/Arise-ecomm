import { env } from '../../config/env.js';

// Uploads are stored with the origin they were made on (often localhost); devices need the configured one.
export const deviceUrl = (url) => (url ? url.replace(/^https?:\/\/[^/]+(?=\/uploads\/)/, env.PUBLIC_ORIGIN) : null);
