import { AxiosError } from 'axios';

const LATENCY_MS = 180;
let methods;

export const resetCustomerPaymentMethodsFixture = () => {
  methods = [
    {
      id: 'pm-card-1',
      type: 'CARD',
      brand: 'Visa',
      label: 'Visa ending 4242',
      last4: '4242',
      expiryMonth: 8,
      expiryYear: 2028,
      isDefault: true,
    },
  ];
};
resetCustomerPaymentMethodsFixture();

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
    response(config, { error: { code, message, retryable: false } }, status),
  );
};

export const customerPaymentMethodsFixtureAdapter = async config => {
  await wait();
  if (config.url === '/payment-methods' && config.method === 'get') {
    return response(config, { data: { items: methods } });
  }
  if (config.url === '/payment-methods/setup-sessions' && config.method === 'post') {
    const returnUrl = config.data?.returnUrl;
    if (!returnUrl)
      return reject(config, 422, 'RETURN_URL_REQUIRED', 'A provider return URL is required.');
    return response(
      config,
      {
        data: {
          id: 'pm-setup-fixture',
          status: 'CREATED',
          providerAction: {
            type: 'REDIRECT',
            url: 'https://payments.example.com/customer/setup/pm-setup-fixture',
            returnUrl,
          },
          expiresAt: '2027-01-01T00:00:00.000Z',
        },
      },
      201,
    );
  }
  const match = config.url?.match(/^\/payment-methods\/([^/]+)$/);
  if (match && config.method === 'delete') {
    const id = decodeURIComponent(match[1]);
    if (!methods.some(method => method.id === id))
      return reject(config, 404, 'PAYMENT_METHOD_NOT_FOUND', 'Payment method was not found.');
    methods = methods.filter(method => method.id !== id);
    return response(config, { data: { deleted: true } });
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No payment-method fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};
