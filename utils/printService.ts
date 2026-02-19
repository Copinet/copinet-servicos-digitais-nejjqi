import { PDFDocument } from 'pdf-lib';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface PrintFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export const getFileArrayBuffer = async (uri: string): Promise<ArrayBuffer> => {
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
  try {
    const pdfDoc = await PDFDocument.create();

    for (const img of images) {
      const imageBytes = await getFileArrayBuffer(img.uri);
      let image;

      try {
        // Try embedding as JPG first (most common for photos)
        image = await pdfDoc.embedJpg(imageBytes);
      } catch (e) {
        // Fallback to PNG if JPG fails
        try {
          image = await pdfDoc.embedPng(imageBytes);
        } catch (e2) {
          console.warn(`Could not embed image ${img.name}:`, e2);
          continue; // Skip image if it fails
        }
      }

      if (image) {
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }
    }

    const pdfBase64 = await pdfDoc.saveAsBase64();
    const uri = FileSystem.documentDirectory + `converted_images_${Date.now()}.pdf`;
    await FileSystem.writeAsStringAsync(uri, pdfBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return uri;
  } catch (error) {
    console.error('Error converting images to PDF:', error);
    throw error;
  }
};

/**
 * Converts a Word document (.docx) to PDF
 * Currently disabled as it requires external libraries not present in the native build.
 * Throws error to trigger fallback estimation logic in the UI.
 */
export const convertWordToPdf = async (uri: string): Promise<string> => {
  // Gracefully throw to trigger the fallback UI
  throw new Error('Word conversion not supported locally');
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

