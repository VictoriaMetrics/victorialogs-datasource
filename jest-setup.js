// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';

import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });

// jsdom has no ResizeObserver. A no-op stub lets size-aware hooks such as useElementWidth mount;
// a test that needs to drive resize callbacks overrides it locally and restores it afterwards
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
