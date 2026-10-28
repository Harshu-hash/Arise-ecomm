import { App as AntApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@core/api/queryClient';
import { buildTheme } from '@theme/antdTheme';
import { useThemeEffect } from '@theme/themeStore';
import { SELLER_ACCENT, SELLER_ACCENT_HOVER } from '@seller/theme';
import { router } from './router';

function sellerTheme(mode) {
  const base = buildTheme(mode);
  return {
    ...base,
    token: {
      ...base.token,
      colorPrimary: SELLER_ACCENT,
      colorInfo: SELLER_ACCENT,
      colorLink: SELLER_ACCENT,
      colorLinkHover: SELLER_ACCENT_HOVER,
    },
  };
}

export default function App() {
  const mode = useThemeEffect();

  return (
    <ConfigProvider
      locale={enUS}
      theme={sellerTheme(mode)}
      form={{ validateMessages: { required: 'This field is required' } }}
    >
      <AntApp
        style={{ height: '100%' }}
        notification={{ placement: 'bottomRight', duration: 4 }}
        message={{ duration: 3, maxCount: 3 }}
      >
        <div style={{ '--arise-focus': SELLER_ACCENT, height: '100%' }}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </div>
      </AntApp>
    </ConfigProvider>
  );
}
