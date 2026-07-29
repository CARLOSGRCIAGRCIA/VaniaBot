export type ConversionAction = 'pdf2img' | 'ppt2pdf' | 'docx2pdf';

export type ImageFormat = 'jpeg' | 'png';

export interface ConvertOptions {
  format?: ImageFormat;
}

export interface ConversionResult {
  data: Buffer;
  fileName: string;
  mimeType: string;
}
