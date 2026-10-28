import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';

const StatusBarManager = ({ barStyle = 'dark-content', themeColor }) => {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (themeColor) {
        document.body.style.backgroundColor = themeColor;
        let metaTheme = document.querySelector('meta[name="theme-color"]');
        if (!metaTheme) {
          metaTheme = document.createElement('meta');
          metaTheme.name = 'theme-color';
          document.head.appendChild(metaTheme);
        }
        metaTheme.setAttribute('content', themeColor);
      }
    }
  }, [themeColor]);

  return (
    <StatusBar
      barStyle={barStyle}
      backgroundColor="transparent"
      translucent={true}
      animated={true}
    />
  );
};

export default StatusBarManager;

