import axios from 'axios';
import { API_CONFIG, ENV } from '@configs';
import { customerFixtureAdapter } from '@mocks/customerFixtureAdapter';

export const apiClient = axios.create({
  baseURL: API_CONFIG.baseUrl,
  timeout: API_CONFIG.timeoutMs,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

// Refresh uses a separate client so a failed refresh cannot recursively invoke
// the response interceptor installed on apiClient.
export const refreshClient = axios.create({
  baseURL: API_CONFIG.baseUrl,
  timeout: API_CONFIG.timeoutMs,
  headers: { Accept: 'application/json' },
});

if (ENV.enableApiMocks) {
  apiClient.defaults.adapter = customerFixtureAdapter;
  refreshClient.defaults.adapter = customerFixtureAdapter;
}
