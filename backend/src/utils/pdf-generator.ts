import { PDFDocument, PDFPage } from 'pdf-lib';
import type { App } from '../index.js';

/**
 * Generates a PDF from image URLs for scan_to_pdf workflow
 * @param imageUrls - Array of image URLs to include in the PDF
 * @param logger - Logger instance for debugging
 * @returns Buffer containing the generated PDF
 */
export async function generatePdfFromImages(
  imageUrls: string[],
  logger?: any
): Promise<Buffer> {
  try {
    if (!imageUrls || imageUrls.length === 0) {
      throw new Error('No image URLs provided');
    }

    logger?.info({ imageCount: imageUrls.length }, 'Starting PDF generation from images');

    const pdfDoc = await PDFDocument.create();

    // Process each image and add to PDF
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      logger?.info({ imageIndex: i + 1, totalImages: imageUrls.length, url: imageUrl }, 'Processing image for PDF');

      try {
        // Fetch image from URL
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBytes = new Uint8Array(imageBuffer);

        // Determine image type and embed
        let embeddedImage;
        const contentType = imageResponse.headers.get('content-type')?.toLowerCase() || '';

        if (contentType.includes('jpeg') || imageUrl.toLowerCase().endsWith('.jpg') || imageUrl.toLowerCase().endsWith('.jpeg')) {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } else if (contentType.includes('png') || imageUrl.toLowerCase().endsWith('.png')) {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else if (contentType.includes('webp') || imageUrl.toLowerCase().endsWith('.webp')) {
          // For WebP, we would need a converter, but for now log a warning
          logger?.warn(
            { imageIndex: i + 1, url: imageUrl },
            'WebP images are not natively supported by PDF, attempting to process'
          );
          // Try as PNG fallback
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else {
          throw new Error(`Unsupported image type: ${contentType}`);
        }

        // Get image dimensions
        const { width: imgWidth, height: imgHeight } = embeddedImage.scale(1);

        // Standard A4 page dimensions in points (72 DPI)
        const a4Width = 595.28; // 210mm
        const a4Height = 841.89; // 297mm
        const margin = 10;

        // Calculate scaling to fit image on A4 page
        const maxWidth = a4Width - 2 * margin;
        const maxHeight = a4Height - 2 * margin;

        let scaledWidth = imgWidth;
        let scaledHeight = imgHeight;

        if (scaledWidth > maxWidth || scaledHeight > maxHeight) {
          const widthRatio = maxWidth / scaledWidth;
          const heightRatio = maxHeight / scaledHeight;
          const ratio = Math.min(widthRatio, heightRatio);
          scaledWidth = scaledWidth * ratio;
          scaledHeight = scaledHeight * ratio;
        }

        // Center image on page
        const x = (a4Width - scaledWidth) / 2;
        const y = (a4Height - scaledHeight) / 2;

        // Add page with image
        const page = pdfDoc.addPage([a4Width, a4Height]);
        page.drawImage(embeddedImage, {
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
        });

        logger?.info(
          { imageIndex: i + 1, scaledWidth, scaledHeight },
          'Image added to PDF page'
        );
      } catch (imageError) {
        logger?.error(
          { imageIndex: i + 1, url: imageUrl, error: (imageError as Error).message },
          'Failed to process image'
        );
        throw imageError;
      }
    }

    // Save PDF to buffer
    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    logger?.info(
      { imageCount: imageUrls.length, pdfSizeBytes: buffer.length, pdfSizeMB: (buffer.length / 1024 / 1024).toFixed(2) },
      'PDF generated successfully'
    );

    return buffer;
  } catch (error) {
    logger?.error(
      { error: (error as Error).message, imageCount: imageUrls?.length },
      'Failed to generate PDF from images'
    );
    throw error;
  }
}

/**
 * Uploads generated PDF to storage and returns signed URL
 * @param storage - Storage instance from app
 * @param pdfBuffer - PDF buffer to upload
 * @param printJobId - Print job ID for organization
 * @param userId - User ID for organization
 * @param logger - Logger instance
 * @returns Promise with signed URL
 */
export async function uploadGeneratedPdf(
  storage: any,
  pdfBuffer: Buffer,
  printJobId: string,
  userId: string,
  logger?: any
): Promise<string> {
  try {
    const timestamp = Date.now();
    const key = `generated-pdfs/${userId}/${printJobId}-${timestamp}.pdf`;

    logger?.info({ userId, printJobId, key, sizeBytes: pdfBuffer.length }, 'Uploading generated PDF to storage');

    const uploadedKey = await storage.upload(key, pdfBuffer);

    logger?.info({ printJobId, uploadedKey }, 'Generated PDF uploaded successfully');

    // Get signed URL for 7 days (standard retention period)
    const { url } = await storage.getSignedUrl(uploadedKey);

    logger?.info({ printJobId, expiryDays: 7 }, 'Generated PDF signed URL created');

    return url;
  } catch (error) {
    logger?.error(
      { printJobId, userId, error: (error as Error).message },
      'Failed to upload generated PDF'
    );
    throw error;
  }
}
