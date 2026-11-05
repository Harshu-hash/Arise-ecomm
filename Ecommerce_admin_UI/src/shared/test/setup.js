import '@testing-library/jest-dom/vitest';

// recharts' ResponsiveContainer needs this to measure its box; jsdom does not provide it.
if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Ant Design reads matchMedia for its responsive grid; jsdom does not provide it.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// Ant Design asks for pseudo-element styles while measuring scrollbars.
// JSDOM does not implement that overload and otherwise floods CI with noise.
const nativeGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element) => nativeGetComputedStyle(element);
