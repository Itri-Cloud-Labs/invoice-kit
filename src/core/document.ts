import { writeFile } from "node:fs/promises";
import type { BusinessDocumentData, PdfRenderOptions } from "./types.js";
import { renderDocumentPdf } from "../renderers/pdf.js";

export class BusinessDocument {
  public constructor(private readonly data: BusinessDocumentData) {}

  public toJSON(): BusinessDocumentData {
    return this.data;
  }

  public async toPDF(outputPathOrOptions?: string | PdfRenderOptions): Promise<Uint8Array> {
    const options = typeof outputPathOrOptions === "string"
      ? { outputPath: outputPathOrOptions }
      : outputPathOrOptions;

    const pdfBytes = await renderDocumentPdf(this.data, options);

    if (options?.outputPath) {
      await writeFile(options.outputPath, pdfBytes);
    }

    return pdfBytes;
  }
}
