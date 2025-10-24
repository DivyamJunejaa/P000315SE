import '@testing-library/jest-dom';

// Polyfill ResizeObserver used by Recharts in test environment
if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'undefined') {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserver;
}

if (typeof global !== 'undefined' && typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = window.ResizeObserver;
}