// Vite bundler needs Node polyfills
import { Buffer } from "buffer";
globalThis.Buffer = Buffer;
window.global = window.global ?? window;
window.process = window.process ?? { env: {} };

export {};
