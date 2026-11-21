import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ErrorBoundary from './ErrorBoundary';

// Just what the theme and AppButton use; this Jest setup does not compile reanimated's own mock.
jest.mock('react-native-reanimated', () => {
  const curve = () => () => 0;
  return {
    __esModule: true,
    default: { createAnimatedComponent: component => component },
    Easing: { bezier: curve, out: curve, in: curve, inOut: curve, cubic: () => 0 },
    useSharedValue: value => ({ value }),
    useAnimatedStyle: () => ({}),
    withTiming: value => value,
  };
});

const Crash = () => {
  throw new Error('boom');
};

describe('ErrorBoundary', () => {
  it('shows its fallback even though it sits outside the app ThemeProvider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    let tree;
    act(() => {
      tree = renderer.create(
        <ErrorBoundary>
          <Crash />
        </ErrorBoundary>,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Arise needs to restart this screen');
    console.error.mockRestore();
  });
});
