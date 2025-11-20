declare module "pdfjs-dist/webpack" {
  import type { GlobalWorkerOptions } from "pdfjs-dist";

  export const GlobalWorkerOptions: GlobalWorkerOptions;

  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<{
      items: Array<{ str?: string }>;
    }>;
  }

  export function getDocument(src: {
    data: Uint8Array | ArrayBuffer;
  }): { promise: Promise<PDFDocumentProxy> };
}
