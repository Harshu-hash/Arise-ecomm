export const linking = {
  prefixes: ['arise://'],
  config: {
    screens: {
      Onboarding: 'welcome',
      Auth: {
        screens: {
          Login: 'login',
          Signup: 'signup',
          ResetPassword: 'password/reset',
        },
      },
      Customer: {
        screens: {
          MainTabs: {
            screens: {
              Home: 'home',
              Categories: 'categories',
              Account: 'account',
              Cart: 'cart',
            },
          },
          ProductDetail: 'products/:productId',
          Category: 'categories/:categoryId',
          Search: 'search',
          Offers: 'offers',
          DealDetail: 'offers/:dealId',
          MyOrders: 'orders',
          OrderDetail: 'orders/:orderId',
          Tracking: 'orders/:orderId/tracking',
          Wishlist: 'wishlist',
          AddCard: 'payment-methods/setup-complete',
          HelpCenter: 'help',
          TicketDetail: 'support/tickets/:ticketId',
        },
      },
    },
  },
};
