import { AxiosError } from 'axios';

const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});

let sellerLead = null;

export const customerSellerFixtureAdapter = async config => {
  if (config.url === '/seller-leads/me' && config.method === 'get') {
    return response(config, { data: sellerLead });
  }
  if (config.url === '/seller-leads' && config.method === 'post') {
    sellerLead ??= {
      id: `seller-lead-${Date.now()}`,
      status: 'RECEIVED',
      submittedAt: new Date().toISOString(),
    };
    return response(
      config,
      { data: sellerLead },
      201,
    );
  }
  throw new AxiosError('Seller fixture not implemented', 'FIXTURE_NOT_IMPLEMENTED', config);
};
