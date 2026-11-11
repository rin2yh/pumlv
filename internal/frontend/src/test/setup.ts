import { Blob as NodeBlob } from "node:buffer";

// React 19 requires this flag so `act()` flushes effects in jsdom.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Shiki 4.6 decompresses its bundled Oniguruma WASM through Blob.stream(),
// which jsdom's Blob does not implement. Use Node's standards-compliant Blob
// in unit tests so the real highlighter can initialize.
Object.defineProperty(globalThis, "Blob", { value: NodeBlob });

// react-zoom-pan-pinch uses ResizeObserver internally; jsdom doesn't provide it.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
