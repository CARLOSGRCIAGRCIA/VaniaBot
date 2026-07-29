import { ImageToPdfService } from './ImageToPdfService.js';
import { PythonBridge } from './PythonBridge.js';
import type { ConversionResult, ImageFormat } from './types.js';

export class ConversionService {
  private static instance: ConversionService;
  private imageToPdf: ImageToPdfService;
  private pythonBridge: PythonBridge;

  private constructor() {
    this.imageToPdf = ImageToPdfService.getInstance();
    this.pythonBridge = PythonBridge.getInstance();
  }

  static getInstance(): ConversionService {
    if (!ConversionService.instance) {
      ConversionService.instance = new ConversionService();
    }
    return ConversionService.instance;
  }

  async imagesToPdf(images: Buffer[]): Promise<ConversionResult> {
    const data = await this.imageToPdf.convert(images);
    return {
      data,
      fileName: `documento.pdf`,
      mimeType: 'application/pdf',
    };
  }

  async pdfToImages(pdfBuffer: Buffer, format: ImageFormat = 'jpeg'): Promise<ConversionResult> {
    const data = await this.pythonBridge.execute('pdf2img', pdfBuffer, { format });
    const ext = format === 'png' ? 'png' : 'jpg';
    return {
      data,
      fileName: `paginas.${ext === 'png' ? 'zip' : 'zip'}`,
      mimeType: 'application/zip',
    };
  }

  async pptToPdf(pptBuffer: Buffer): Promise<ConversionResult> {
    const data = await this.pythonBridge.execute('ppt2pdf', pptBuffer);
    return {
      data,
      fileName: `presentacion.pdf`,
      mimeType: 'application/pdf',
    };
  }

  async docxToPdf(docxBuffer: Buffer): Promise<ConversionResult> {
    const data = await this.pythonBridge.execute('docx2pdf', docxBuffer);
    return {
      data,
      fileName: `documento.pdf`,
      mimeType: 'application/pdf',
    };
  }
}
