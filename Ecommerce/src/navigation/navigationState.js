import { CUSTOMER_ROUTES, ROOT_ROUTES } from './routes';

export const buildCustomerRootState = returnTo => {
  const customerRoutes = returnTo
    ? [{ name: CUSTOMER_ROUTES.mainTabs }, returnTo]
    : [{ name: CUSTOMER_ROUTES.mainTabs }];

  return {
    index: 0,
    routes: [
      {
        name: ROOT_ROUTES.customer,
        state: {
          index: customerRoutes.length - 1,
          routes: customerRoutes,
        },
      },
    ],
  };
};
