import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { reportException } from '@core/crashReporting';
import { COLORS } from '@constants/colors';
import { SPACING } from '@constants/spacing';
import AppButton from '@shared/buttons/AppButton';
import { ThemeProvider } from '@theme';

class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportException(error, { componentStack: info.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    // The boundary wraps every provider (so it catches their errors too), so the fallback brings its own theme.
    return (
      <ThemeProvider>
        <View style={styles.container}>
          <Text style={styles.title}>Arise needs to restart this screen</Text>
          <Text style={styles.message}>
            An unexpected app error occurred. No payment or order action was retried automatically.
          </Text>
          <AppButton title="Try again" onPress={this.reset} />
        </View>
      </ThemeProvider>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    backgroundColor: COLORS.background,
  },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  message: {
    color: COLORS.textSecondary,
    marginVertical: SPACING.l,
    lineHeight: 20,
    textAlign: 'center',
  },
});

export default ErrorBoundary;
