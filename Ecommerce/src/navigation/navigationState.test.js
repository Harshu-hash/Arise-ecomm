import { buildCustomerRootState } from './navigationState';

describe('buildCustomerRootState', () => {
  it('opens the customer tabs after a direct login', () => {
    expect(buildCustomerRootState()).toEqual({
      index: 0,
      routes: [
        {
          name: 'Customer',
          state: { index: 0, routes: [{ name: 'MainTabs' }] },
        },
      ],
    });
  });

  it('restores the guarded destination after authentication', () => {
    const returnTo = { name: 'OrderDetail', params: { orderId: 'ord_1' } };
    const state = buildCustomerRootState(returnTo);

    expect(state.routes[0].state).toEqual({
      index: 1,
      routes: [{ name: 'MainTabs' }, returnTo],
    });
  });
});
