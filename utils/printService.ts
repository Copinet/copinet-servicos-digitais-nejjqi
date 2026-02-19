import { PDFDocument } from 'pdf-lib';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import mammoth from 'mammoth';
import { Buffer } from 'buffer';

// Polyfill Buffer for mammoth
if (typeof global.Buffer === 'undefined') {
  (global as any).Buffer = Buffer;
}

export interface PrintFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export const getFileArrayBuffer = async (uri: string): Promise<ArrayBuffer> => {
  // On web or some environments, fetch might be better, but for Expo FileSystem is standard
  // However, the existing code uses fetch for efficiency with blobs/buffers in React Native sometimes.
  // Let's stick to the efficient fetch method seen in quick-print.tsx
  const response = await fetch(uri);
  return await response.arrayBuffer();
};

export const countPdfPages = async (uri: string): Promise<number> => {
  try {
    const arrayBuffer = await getFileArrayBuffer(uri);
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Error counting PDF pages:', error);
    throw new Error('Failed to count PDF pages');
  }
};

export const convertImagesToPdf = async (images: PrintFile[]): Promise<string> => {
  const platform = Platform.OS;

  if (platform === 'ios') {
    // iOS logic to convert images
    try {
      // Use expo-print to generate PDF from images
      // This is a robust way to create a PDF from images on iOS
      let htmlContent = '<html><body style="margin:0;padding:0;">';

      for (const img of images) {
        // Convert image to base64 to embed in HTML to ensure it renders
        const base64 = await FileSystem.readAsStringAsync(img.uri, { encoding: FileSystem.EncodingType.Base64 });
        const src = `data:image/jpeg;base64,${base64}`;
        htmlContent += `<img src="${src}" style="width:100%;height:auto;display:block;page-break-after:always;" />`;
      }

      htmlContent += '</body></html>';

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      return uri;
    } catch (error) {
      console.error('Error converting images to PDF:', error);
      throw error;
    }
  } else {
    // Android logic (can use pdf-lib or ensure print works)
    // Reusing the same HTML print approach as it is cross-platform and reliable
    try {
      let htmlContent = '<html><body style="margin:0;padding:0;">';

      for (const img of images) {
        const base64 = await FileSystem.readAsStringAsync(img.uri, { encoding: FileSystem.EncodingType.Base64 });
        const src = `data:image/jpeg;base64,${base64}`;
        htmlContent += `<img src="${src}" style="width:100%;height:auto;display:block;page-break-after:always;" />`;
      }

      htmlContent += '</body></html>';

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      return uri;
    } catch (error) {
      console.error('Error converting images to PDF android:', error);
      throw error;
    }
  }
};

/**
 * Converts a Word document (.docx) to PDF
 * Uses mammoth to convert to HTML, then expo-print to convert HTML to PDF
 */
export const convertWordToPdf = async (uri: string): Promise<string> => {
  try {
    console.log('Converting Word to PDF:', uri);

    // Read file as Base64 to create Buffer
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const buffer = Buffer.from(base64, 'base64');

    // Convert Docx to HTML
    const result = await mammoth.convertToHtml({ buffer: buffer });
    const html = result.value;
    const messages = result.messages; // Any warnings

    if (messages && messages.length > 0) {
      console.log('Mammoth warnings:', messages);
    }

    // Wrap HTML in a clean structure for printing
    const fullHtml = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 20px; }
            p { margin-bottom: 10px; line-height: 1.5; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #ddd; padding: 8px; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    // Print HTML to PDF
    const { uri: pdfUri } = await Print.printToFileAsync({
      html: fullHtml,
      base64: false,
    });

    console.log('Word converted to PDF at:', pdfUri);
    return pdfUri;
  } catch (error) {
    console.error('Error in convertWordToPdf:', error);
    throw new Error('Falha ao converter arquivo Word para PDF.');
  }
};

export interface PricingConfig {
  bwPrice: number;
  colorPrice: number;
}

export const calculatePrintCost = (
  pages: number,
  copies: number,
  colorMode: 'bw' | 'color',
  config: PricingConfig
): number => {
  const pricePerPage = colorMode === 'color' ? config.colorPrice : config.bwPrice;
  return pricePerPage * pages * copies;
};
