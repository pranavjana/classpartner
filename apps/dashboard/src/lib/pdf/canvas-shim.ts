/**
 * Minimal stub for the `canvas` package.
 * pdfjs-dist tries to require this when bundling for Node, but the browser build never calls it.
 * Providing a lightweight shim keeps Turbopack from failing during resolution.
 */

type CanvasContextStub = {
  measureText: (text: string) => { width: number };
  fillText: (...args: unknown[]) => void;
  beginPath: () => void;
  moveTo: (...args: unknown[]) => void;
  lineTo: (...args: unknown[]) => void;
  stroke: () => void;
  closePath: () => void;
  save: () => void;
  restore: () => void;
  scale: (...args: unknown[]) => void;
  fill: () => void;
};

type CanvasStub = {
  getContext: (_type: "2d") => CanvasContextStub;
  toBuffer?: () => ArrayBuffer;
};

const noop = () => {};

const context: CanvasContextStub = {
  measureText: () => ({ width: 0 }),
  fillText: noop,
  beginPath: noop,
  moveTo: noop,
  lineTo: noop,
  stroke: noop,
  closePath: noop,
  save: noop,
  restore: noop,
  scale: noop,
  fill: noop,
};

const createCanvas = (): CanvasStub => ({ getContext: () => context });

export const registerFont = noop;
export const loadImage = async () => {
  throw new Error("loadImage is not available in the browser canvas shim.");
};
export { createCanvas };

const canvasShim = {
  createCanvas,
  registerFont,
  loadImage,
};

export default canvasShim;
